const { sql, query, execute } = require('../db/sqlserver');

async function list(args) {
  let sqlText = `
    SELECT id, order_no, client_name, state, mark, remark, total_amount, create_time
    FROM dbo.tb_Order
    WHERE 1=1
  `;
  const params = [];

  if (args.showDeleted !== true) {
    sqlText += ` AND state <> -1 `;
  }

  if (args.mark !== undefined && args.mark !== null && args.mark !== '') {
    sqlText += ` AND mark = @mark `;
    params.push({ name: 'mark', type: sql.Int, value: Number(args.mark) });
  }

  if (args.state !== undefined && args.state !== null && args.state !== '') {
    sqlText += ` AND state = @state `;
    params.push({ name: 'state', type: sql.Int, value: Number(args.state) });
  }

  if (args.keyword) {
    sqlText += ` AND (order_no LIKE @keyword OR client_name LIKE @keyword OR remark LIKE @keyword) `;
    params.push({ name: 'keyword', type: sql.NVarChar(100), value: `%${args.keyword}%` });
  }

  sqlText += ` ORDER BY id DESC `;

  return await query(sqlText, params);
}

async function create(args) {
  const sqlText = `
    INSERT INTO dbo.tb_Order(order_no, client_name, state, mark, remark, total_amount, create_time)
    VALUES(@order_no, @client_name, 0, 1, @remark, @total_amount, GETDATE());

    SELECT TOP 1 *
    FROM dbo.tb_Order
    WHERE order_no = @order_no
    ORDER BY id DESC;
  `;

  return await query(sqlText, [
    { name: 'order_no', type: sql.NVarChar(50), value: args.order_no },
    { name: 'client_name', type: sql.NVarChar(100), value: args.client_name },
    { name: 'remark', type: sql.NVarChar(500), value: args.remark || '' },
    { name: 'total_amount', type: sql.Decimal(18, 2), value: Number(args.total_amount || 0) }
  ]);
}

async function updateMark(args) {
  const sqlText = `
    UPDATE dbo.tb_Order
    SET mark = @mark
    WHERE id = @id AND state <> -1;

    SELECT *
    FROM dbo.tb_Order
    WHERE id = @id;
  `;

  return await query(sqlText, [
    { name: 'id', type: sql.Int, value: Number(args.id) },
    { name: 'mark', type: sql.Int, value: Number(args.mark) }
  ]);
}

async function remove(args) {
  const sqlText = `
    UPDATE dbo.tb_Order
    SET state = -1
    WHERE id = @id;

    SELECT *
    FROM dbo.tb_Order
    WHERE id = @id;
  `;

  return await query(sqlText, [
    { name: 'id', type: sql.Int, value: Number(args.id) }
  ]);
}

async function remark(args) {
  const sqlText = `
    UPDATE dbo.tb_Order
    SET remark = @remark,
        mark = 4
    WHERE id = @id AND state <> -1;

    SELECT *
    FROM dbo.tb_Order
    WHERE id = @id;
  `;

  return await query(sqlText, [
    { name: 'id', type: sql.Int, value: Number(args.id) },
    { name: 'remark', type: sql.NVarChar(500), value: args.remark || '' }
  ]);
}

module.exports = {
  list,
  create,
  updateMark,
  remove,
  remark
};