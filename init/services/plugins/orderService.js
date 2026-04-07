const { query, sql } = require("../../db/sqlserver");

const list = {
  "@Action": "列表，记录，查询，查找，搜索",
  "@Desc": "根据订单号、客户名、状态、时间范围查询订单列表。",
  "@Required": [],
  "@Enum": {
    mark: {
      "待处理": 1,
      "处理中": 2,
      "已处理": 3,
      "完成": 3
    }
  },
  "@ArgTemp": {
    order_no: "",
    client_name: "",
    mark: 0,
    create_time: []
  },
  "@Examples": [
    {
      input: "查询张三的订单",
      output: { client_name: "张三" }
    },
    {
      input: "查上月已处理订单",
      output: {
        mark: 3,
        create_time: ["2026-03-01 00:00:00", "2026-03-31 23:59:59"]
      }
    }
  ],
  handler: async (args) => {
    let sqlText = `
      SELECT id, order_no, client_name, mark, total_amount, remark, create_time
      FROM dbo.tb_Order
      WHERE state <> -1
    `;
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
      params.push({
        name: "mark",
        type: sql.Int,
        value: Number(args.mark),
      });
    }

    if (Array.isArray(args.create_time) && args.create_time.length === 2) {
      sqlText += ` AND create_time BETWEEN @start AND @end`;
      params.push(
        { name: "start", type: sql.DateTime, value: args.create_time[0] },
        { name: "end", type: sql.DateTime, value: args.create_time[1] }
      );
    }

    sqlText += ` ORDER BY id DESC`;
    return await query(sqlText, params);
  },
};

const update = {
  "@Action": "修改，编辑，更新，变更",
  "@Desc": "修改现有订单的信息，可修改客户名、金额、备注。",
  "@Required": ["id"],
  "@ArgTemp": {
    id: 0,
    client_name: "",
    total_amount: 0,
    remark: "",
  },
  "@Examples": [
    {
      input: "把第二个订单备注改成加急",
      output: { id: 0, remark: "加急" }
    }
  ],
  handler: async (args) => {
    if (!args.id) throw new Error("操作失败：未识别到目标订单 ID");

    const sqlText = `
      UPDATE dbo.tb_Order
      SET client_name = ISNULL(@client, client_name),
          total_amount = ISNULL(@amount, total_amount),
          remark = ISNULL(@remark, remark)
      WHERE id = @id;

      SELECT * FROM dbo.tb_Order WHERE id = @id;
    `;

    return await query(sqlText, [
      { name: "id", type: sql.Int, value: Number(args.id) },
      {
        name: "client",
        type: sql.NVarChar(100),
        value: args.client_name || null,
      },
      {
        name: "amount",
        type: sql.Decimal(18, 2),
        value:
          args.total_amount !== undefined &&
          args.total_amount !== null &&
          args.total_amount !== ""
            ? Number(args.total_amount)
            : null,
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
  "@Action": "增加，新建，创建，新增",
  "@Desc": "创建一个全新的订单记录。",
  "@Required": ["order_no", "client_name", "total_amount"],
  "@ArgTemp": {
    order_no: "",
    client_name: "",
    total_amount: 0,
  },
  "@Examples": [
    {
      input: "创建订单，单号 SO20260407001，客户张三，金额 300",
      output: {
        order_no: "SO20260407001",
        client_name: "张三",
        total_amount: 300
      }
    }
  ],
  handler: async (args) => {
    if (!args.order_no) throw new Error("操作失败：缺少订单编号");
    if (!args.client_name) throw new Error("操作失败：缺少客户姓名");
    if (args.total_amount === undefined || args.total_amount === null || args.total_amount === "") {
      throw new Error("操作失败：缺少订单金额");
    }

    const sqlText = `
      INSERT INTO dbo.tb_Order
      (order_no, client_name, total_amount, mark, state, create_time, remark)
      VALUES (@no, @name, @amount, 1, 0, GETDATE(), '');

      SELECT TOP 1 * FROM dbo.tb_Order ORDER BY id DESC;
    `;

    return await query(sqlText, [
      { name: "no", type: sql.NVarChar(50), value: args.order_no },
      { name: "name", type: sql.NVarChar(100), value: args.client_name },
      {
        name: "amount",
        type: sql.Decimal(18, 2),
        value: Number(args.total_amount),
      },
    ]);
  },
};

const update_mark = {
  "@Action": "更新状态，修改状态，标记状态，状态变更",
  "@Desc": "根据订单 ID 或订单号更新订单状态。",
  "@Required": ["mark"],
  "@Enum": {
    mark: {
      "待处理": 1,
      "处理中": 2,
      "已处理": 3,
      "完成": 3
    }
  },
  "@ArgTemp": {
    id: 0,
    order_no: "",
    mark: 0,
  },
  "@Examples": [
    {
      input: "把订单 SO001 改成已处理",
      output: { order_no: "SO001", mark: 3 }
    }
  ],
  handler: async (args) => {
    if (!args.id && !args.order_no) {
      throw new Error("操作失败：未识别到订单 ID 或订单号");
    }

    if (![1, 2, 3].includes(Number(args.mark))) {
      throw new Error("操作失败：无效的状态标记");
    }

    const sqlText = `
      DECLARE @TargetID INT = @id;

      IF (@TargetID = 0 OR @TargetID IS NULL) AND (@order_no <> '')
      BEGIN
          SELECT TOP 1 @TargetID = id
          FROM dbo.tb_Order
          WHERE order_no = @order_no AND state <> -1;
      END

      IF @TargetID IS NOT NULL AND @TargetID <> 0
      BEGIN
          UPDATE dbo.tb_Order
          SET mark = @mark
          WHERE id = @TargetID;

          SELECT * FROM dbo.tb_Order WHERE id = @TargetID;
      END
      ELSE
      BEGIN
          RAISERROR('未找到对应的订单记录', 16, 1);
      END
    `;

    return await query(sqlText, [
      { name: "id", type: sql.Int, value: Number(args.id || 0) },
      { name: "order_no", type: sql.NVarChar(50), value: args.order_no || "" },
      { name: "mark", type: sql.Int, value: Number(args.mark) },
    ]);
  },
};

const aggregate = {
  "@Action": "统计，聚合，求和，汇总，分析",
  "@Desc": "统计订单数量、金额、平均值，可按状态、客户、时间段汇总。",
  "@Required": [],
  "@Enum": {
    groupBy: {
      "状态": "mark",
      "按状态": "mark",
      "客户": "client_name",
      "按客户": "client_name",
      "客户名": "client_name"
    },
    mark: {
      "待处理": 1,
      "处理中": 2,
      "已处理": 3,
      "完成": 3
    }
  },
  "@ArgTemp": {
    groupBy: "",
    mark: 0,
    client_name: "",
    create_time: [],
  },
  "@Examples": [
    {
      input: "按状态统计本月订单金额",
      output: {
        groupBy: "mark",
        create_time: ["2026-04-01 00:00:00", "2026-04-30 23:59:59"]
      }
    }
  ],
  handler: async (args) => {
    let sqlText = "";
    const params = [];

    if (args.groupBy === "mark") {
      sqlText = `
        SELECT
          mark,
          COUNT(*) AS order_count,
          SUM(total_amount) AS total_amount,
          AVG(total_amount) AS avg_amount
        FROM dbo.tb_Order
        WHERE state <> -1
      `;

      if (Array.isArray(args.create_time) && args.create_time.length === 2) {
        sqlText += ` AND create_time BETWEEN @start AND @end`;
        params.push(
          { name: "start", type: sql.DateTime, value: args.create_time[0] },
          { name: "end", type: sql.DateTime, value: args.create_time[1] }
        );
      }

      if (args.mark) {
        sqlText += ` AND mark = @mark`;
        params.push({ name: "mark", type: sql.Int, value: Number(args.mark) });
      }

      sqlText += ` GROUP BY mark ORDER BY mark`;
    } else if (args.groupBy === "client_name") {
      sqlText = `
        SELECT
          client_name,
          COUNT(*) AS order_count,
          SUM(total_amount) AS total_amount,
          AVG(total_amount) AS avg_amount
        FROM dbo.tb_Order
        WHERE state <> -1
      `;

      if (args.client_name) {
        sqlText += ` AND client_name LIKE @client_name`;
        params.push({
          name: "client_name",
          type: sql.NVarChar(100),
          value: `%${args.client_name}%`,
        });
      }

      if (Array.isArray(args.create_time) && args.create_time.length === 2) {
        sqlText += ` AND create_time BETWEEN @start AND @end`;
        params.push(
          { name: "start", type: sql.DateTime, value: args.create_time[0] },
          { name: "end", type: sql.DateTime, value: args.create_time[1] }
        );
      }

      sqlText += ` GROUP BY client_name ORDER BY total_amount DESC`;
    } else {
      sqlText = `
        SELECT
          COUNT(*) AS order_count,
          SUM(total_amount) AS total_amount,
          AVG(total_amount) AS avg_amount,
          MIN(total_amount) AS min_amount,
          MAX(total_amount) AS max_amount
        FROM dbo.tb_Order
        WHERE state <> -1
      `;

      if (args.mark) {
        sqlText += ` AND mark = @mark`;
        params.push({
          name: "mark",
          type: sql.Int,
          value: Number(args.mark),
        });
      }

      if (Array.isArray(args.create_time) && args.create_time.length === 2) {
        sqlText += ` AND create_time BETWEEN @start AND @end`;
        params.push(
          { name: "start", type: sql.DateTime, value: args.create_time[0] },
          { name: "end", type: sql.DateTime, value: args.create_time[1] }
        );
      }
    }

    return await query(sqlText, params);
  },
};

module.exports = {
  "@Module": "订单",
  "@Alias": ["单子", "订单管理", "销售订单"],
  "@Desc": "订单管理系统。处理订单查询、新增、修改金额/客户名、标记状态及备注信息。",
  actions: {
    list,
    update,
    create,
    update_mark,
    aggregate,
  },
};