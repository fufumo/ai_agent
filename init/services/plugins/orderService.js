const { query, sql } = require("../../db/sqlserver");

const list = {
  "@Action": "list",
  "@Desc": "根据关键词搜索订单，或根据状态标记(mark)筛选。",
  "@ArgTemp": {
    order_no: "", // 可选，仅当用户提到具体的订单号时填充
    client_name: "", // 可选，仅当用户提到具体的客户姓名时填充
    mark: 0, // 可选，仅当用户提到特定状态时填充（1-待处理, 2-处理中, 3-已处理）
    create_time: [] // 可选，时间范围查询，格式为 [start, end]，仅当用户提到具体时间范围时或者提供有关时间段的信息填充 必须填充两个时间 格式为 "YYYY-MM-DD HH:mm:ss" 比如上月 或者上周 等模糊时间描述由 AI 解析后转换 格式：["2026-03-01 00:00:00", "2026-03-31 23:59:59"]
  },
  handler: async (args) => {
    let sqlText = `SELECT id, order_no, client_name, mark, total_amount, remark FROM dbo.tb_Order WHERE state <> -1`;
    const params = [];
    if (args.order_no) {
      sqlText += ` AND order_no LIKE @order_no`;
      params.push({
        name: "order_no",
        type: sql.NVarChar(50),
        value: `%${args.order_no}%`,
      });
    }
    if (args.client_name) {
      sqlText += ` AND client_name LIKE @client_name`;
      params.push({
        name: "client_name",
        type: sql.NVarChar(100),
        value: `%${args.client_name}%`,
      });
    }
    if (args.mark) {
      sqlText += ` AND mark = @mark`;
      params.push({ name: "mark", type: sql.Int, value: args.mark });
    }

    if (args.create_time && args.create_time.length === 2) {
      sqlText += ` AND create_time BETWEEN @start AND @end`;
      params.push(
        { name: "start", type: sql.DateTime, value: args.create_time[0] },
        { name: "end", type: sql.DateTime, value: args.create_time[1] }
      );
    }


    return await query(sqlText + " ORDER BY id DESC", params);
  },
};

const update = {
  "@Action": "update",
  "@Desc": "修改现有订单的信息。可以修改金额、客户姓名或备注。",
  "@ArgTemp": {
    id: 0, // 必需，目标订单的唯一 ID
    client_name: "", // 可选，新的客户姓名 仅当用户提到具体的客户姓名时填充
    total_amount: 0, // 可选，新的订单金额 仅当用户提到具体的订单金额时填充
    remark: "", // 可选，新的备注说明 仅当用户提到具体的备注信息时填充
  },
  handler: async (args) => {
    if (!args.id) throw new Error("AI 未能识别到目标订单 ID");

    // 使用 ISNULL 保证如果 AI 没提某个字段，数据库保持原值
    const sqlText = `
      UPDATE dbo.tb_Order 
      SET client_name = ISNULL(@client, client_name),
          total_amount = ISNULL(@amount, total_amount),
          remark = ISNULL(@remark, remark)
      WHERE id = @id;
      SELECT * FROM dbo.tb_Order WHERE id = @id;
    `;
    return await query(sqlText, [
      { name: "id", type: sql.Int, value: args.id },
      {
        name: "client",
        type: sql.NVarChar(100),
        value: args.client_name || null,
      },
      {
        name: "amount",
        type: sql.Decimal(18, 2),
        value: args.total_amount || null,
      },
      {
        name: "remark",
        type: sql.NVarChar(500),
        value: args.remark || null,
      },
    ]);
  },
};

const create = {
  "@Action": "create",
  "@Desc": "创建一个全新的订单记录。",
  "@ArgTemp": {
    order_no: "", // 必需，订单编号（用户明确提供）
    client_name: "", // 必需，客户姓名（用户明确提供）
    total_amount: 0, // 必需，订单金额，必须是数字（用户明确提供）
  },
  handler: async (args) => {
    const sqlText = `
      INSERT INTO dbo.tb_Order (order_no, client_name, total_amount, mark, state, create_time)
      VALUES (@no, @name, @amount, 1, 0, GETDATE());
      SELECT TOP 1 * FROM dbo.tb_Order ORDER BY id DESC;
    `;
    return await query(sqlText, [
      { name: "no", type: sql.NVarChar(50), value: args.order_no },
      { name: "name", type: sql.NVarChar(100), value: args.client_name },
      {
        name: "amount",
        type: sql.Decimal(18, 2),
        value: args.total_amount,
      },
    ]);
  },
};

const update_mark = {
  "@Action": "update_mark",
  "@Desc": "根据订单 ID 或 订单号更新状态标记。",
  "@ArgTemp": {
    id: 0, // 可选，优先使用 ID
    order_no: "", // 可选，若用户提到具体单号则填充
    mark: 0, // 必需，映射值 (1-3)
  },
  handler: async (args) => {
    // 1. 前置校验：必须有标识符和状态值
    if (!args.id && !args.order_no) {
      throw new Error("操作失败：未识别到订单 ID 或 订单号。");
    }
    if (![1, 2, 3].includes(Number(args.mark))) {
      throw new Error("操作失败：无效的状态标记。");
    }

    // 2. 编写兼容 SQL
    // 逻辑：如果给了 id 用 id，否则用 order_no 匹配
    const sqlText = `
      DECLARE @TargetID INT = @id;

      -- 如果没有直接给 ID，尝试通过单号反查 ID
      IF (@TargetID = 0 OR @TargetID IS NULL) AND (@order_no <> '')
      BEGIN
          SELECT TOP 1 @TargetID = id FROM dbo.tb_Order WHERE order_no = @order_no;
      END

      IF @TargetID IS NOT NULL AND @TargetID <> 0
      BEGIN
          UPDATE dbo.tb_Order SET mark = @mark WHERE id = @TargetID;
          -- 返回更新后的最新数据，用于前端同步 UI
          SELECT * FROM dbo.tb_Order WHERE id = @TargetID;
      END
      ELSE
      BEGIN
          -- 如果最终没找到，抛出错误（会被 catch 捕获）
          RAISERROR('未找到对应的订单记录', 16, 1);
      END
    `;

    return await query(sqlText, [
      { name: "id", type: sql.Int, value: args.id || 0 },
      { name: "order_no", type: sql.VarChar, value: args.order_no || "" },
      { name: "mark", type: sql.Int, value: args.mark },
    ]);
  },
};

module.exports = {
  "@Module": "order",
  "@Desc":
    "订单管理系统。处理订单查询、新增、修改金额/客户名、标记状态及备注信息。",
  actions: {
    list,
    update,
    create,
    update_mark,
  },
};
