const { query, sql } = require('../../db/sqlserver');

module.exports = {
  "@Module": "order",
  "@Desc": "订单管理系统。处理订单查询、新增、修改金额/客户名、标记状态及备注信息。",

  actions: {
    // 1. 查询列表
    list: {
      "@Action": "list",
      "@Desc": "根据关键词搜索订单，或根据状态标记(mark)筛选。",
      "@ArgTemp": {
        "keyword": "", // 订单号或客户名关键词
        "mark": 0      // 状态：1-待处理, 2-处理中, 3-已处理, 4-备注
      },
      handler: async (args) => {
        let sqlText = `SELECT id, order_no, client_name, mark, total_amount, remark FROM dbo.tb_Order WHERE state <> -1`;
        const params = [];
        if (args.keyword) {
          sqlText += ` AND (order_no LIKE @kw OR client_name LIKE @kw)`;
          params.push({ name: 'kw', type: sql.NVarChar(100), value: `%${args.keyword}%` });
        }
        if (args.mark) {
          sqlText += ` AND mark = @mark`;
          params.push({ name: 'mark', type: sql.Int, value: args.mark });
        }
        return await query(sqlText + " ORDER BY id DESC", params);
      }
    },

    // 2. 修改订单 (核心重构：支持 AI 填充)
    update: {
      "@Action": "update",
      "@Desc": "修改现有订单的信息。可以修改金额、客户姓名或备注。",
      "@ArgTemp": {
        "id": 0,             // 订单的唯一 ID
        "client_name": "",   // 新的客户姓名
        "total_amount": 0,   // 新的订单金额（数字）
        "remark": ""         // 新的备注说明
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
          { name: 'id', type: sql.Int, value: args.id },
          { name: 'client', type: sql.NVarChar(100), value: args.client_name || null },
          { name: 'amount', type: sql.Decimal(18, 2), value: args.total_amount || null },
          { name: 'remark', type: sql.NVarChar(500), value: args.remark || null }
        ]);
      }
    },

    // 3. 新增订单
    create: {
      "@Action": "create",
      "@Desc": "创建一个全新的订单记录。",
      "@ArgTemp": {
        "order_no": "",      // 订单编号
        "client_name": "",   // 客户姓名
        "total_amount": 0    // 金额
      },
      handler: async (args) => {
        const sqlText = `
          INSERT INTO dbo.tb_Order (order_no, client_name, total_amount, mark, state, create_time)
          VALUES (@no, @name, @amount, 1, 0, GETDATE());
          SELECT TOP 1 * FROM dbo.tb_Order ORDER BY id DESC;
        `;
        return await query(sqlText, [
          { name: 'no', type: sql.NVarChar(50), value: args.order_no },
          { name: 'name', type: sql.NVarChar(100), value: args.client_name },
          { name: 'amount', type: sql.Decimal(18, 2), value: args.total_amount }
        ]);
      }
    }
  }
};