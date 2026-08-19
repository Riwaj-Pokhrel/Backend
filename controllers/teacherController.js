const db = require("../config/db");
const bcrypt = require("bcrypt");

// Create Teacher
exports.createTeacher = async (req, res) => {

    const { full_name, email, password } = req.body;

    if (!full_name || !email || !password) {
        return res.status(400).json({
            success: false,
            message: "All fields are required."
        });
    }

    db.query(
        "SELECT id FROM users WHERE email = ?",
        [email],
        async (err, result) => {

            if (err) {
                return res.status(500).json({
                    success: false,
                    message: "Database Error"
                });
            }

            if (result.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: "Email already exists."
                });
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            db.query(
                `INSERT INTO users
                (full_name,email,password,role,is_department_admin,is_active)
                VALUES(?,?,?,?,?,?)`,
                [
                    full_name,
                    email,
                    hashedPassword,
                    "TEACHER",
                    false,
                    true
                ],
                (err) => {

                    if (err) {

                        if (err.code === "ER_DUP_ENTRY") {
                            return res.status(400).json({
                                success: false,
                                message: "Email already exists."
                            });
                        }

                        return res.status(500).json({
                            success: false,
                            message: "Database Error"
                        });
                    }

                    return res.status(201).json({
                        success: true,
                        message: "Teacher created successfully."
                    });

                }
            );

        }
    );

};

// View Teachers
exports.getAllTeachers = (req, res) => {

    const sql = `
        SELECT
            id,
            full_name,
            email,
            is_department_admin,
            is_active
        FROM users
        WHERE role='TEACHER'
        ORDER BY full_name ASC
    `;

    db.query(sql, (err, results) => {

        if (err) {
            return res.status(500).json({
                success: false,
                message: "Database Error"
            });
        }

        return res.json({
            success: true,
            teachers: results
        });

    });

};

// Update Teacher
exports.updateTeacher = (req, res) => {

    const { id } = req.params;
    const { full_name, email } = req.body;

    if (!full_name || !email) {
        return res.status(400).json({
            success: false,
            message: "All fields are required."
        });
    }

    db.query(
        `UPDATE users
         SET full_name=?, email=?
         WHERE id=?
         AND role='TEACHER'`,
        [full_name, email, id],
        (err, result) => {

            if (err) {

                if (err.code === "ER_DUP_ENTRY") {
                    return res.status(400).json({
                        success: false,
                        message: "Email already exists."
                    });
                }

                return res.status(500).json({
                    success: false,
                    message: "Database Error"
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Teacher not found."
                });
            }

            return res.json({
                success: true,
                message: "Teacher updated successfully."
            });

        }
    );

};

// Reset Teacher Password

exports.resetTeacherPassword = async (req, res) => {

    const { id } = req.params;
    const { new_password } = req.body;

    if (!new_password) {
        return res.status(400).json({
            success: false,
            message: "New password is required."
        });
    }

    if (new_password.length < 6) {
        return res.status(400).json({
            success: false,
            message: "New password must be at least 6 characters."
        });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);

    db.query(
        `UPDATE users
         SET password=?
         WHERE id=?
         AND role='TEACHER'`,
        [hashedPassword, id],
        (err, result) => {

            if (err) {
                return res.status(500).json({
                    success: false,
                    message: "Database Error"
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Teacher not found."
                });
            }

            return res.json({
                success: true,
                message: "Teacher password reset successfully."
            });

        }
    );

};
exports.toggleTeacherStatus = (req, res) => {

    const { id } = req.params;

    const sql = `
        UPDATE users
        SET is_active = NOT is_active
        WHERE id = ?
        AND role = 'TEACHER'
    `;

    db.query(sql, [id], (err, result) => {

        if (err) {
            return res.status(500).json({
                success: false,
                message: "Database Error"
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Teacher not found."
            });
        }

        return res.json({
            success: true,
            message: "Teacher status updated successfully."
        });

    });

};