const { pool, dbPrefix } = require('../config/db');

const getBookingCommissionData = async (req, res) => {

   try {
        const tableName = `${dbPrefix}booking_commission`;

        // Use async/await syntax with mysql2
        const [rows] = await pool.query(
            `SELECT * FROM \`${tableName}\` WHERE id = ?`,
            [1]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Record not found' });
        }

        res.status(200).json(rows[0]);
    } catch (error) {
        console.error("Internal error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
module.exports = { getBookingCommissionData };
