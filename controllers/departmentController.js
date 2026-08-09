const db = require("../config/db");



// Create Department
// SUPER_ADMIN ONLY


exports.createDepartment = (req, res) => {

    const { department_name } = req.body;

    if (!department_name || !department_name.trim()) {
        return res.status(400).json({
            success: false,
            message: "Department name is required."
        });
    }

    const name = department_name.trim();

    db.query(
        `SELECT id
         FROM departments
         WHERE department_name=?`,
        [name],
        (err, result) => {

            if (err) {
                console.error(err);

                return res.status(500).json({
                    success: false,
                    message: "Database Error"
                });
            }

            if (result.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: "Department already exists."
                });
            }

            db.query(
                `INSERT INTO departments
                (department_name)
                VALUES (?)`,
                [name],
                (err, insertResult) => {

                    if (err) {
                        console.error(err);

                        return res.status(500).json({
                            success: false,
                            message: "Database Error"
                        });
                    }

                    return res.status(201).json({
                        success: true,
                        message: "Department created successfully.",
                        id: insertResult.insertId
                    });

                }
            );

        }
    );
};



// View Departments
// SUPER_ADMIN ONLY


exports.getAllDepartments = (req, res) => {

    db.query(
        `SELECT
            id,
            department_name
         FROM departments
         ORDER BY department_name ASC`,
        (err, results) => {

            if (err) {
                console.error(err);

                return res.status(500).json({
                    success: false,
                    message: "Database Error"
                });
            }

            return res.json({
                success: true,
                departments: results
            });

        }
    );
};



// Update Department
// SUPER_ADMIN ONLY


exports.updateDepartment = (req, res) => {

    const { id } = req.params;
    const { department_name } = req.body;

    if (!department_name || !department_name.trim()) {
        return res.status(400).json({
            success: false,
            message: "Department name is required."
        });
    }

    const name = department_name.trim();

    // Check duplicate name
    db.query(
        `SELECT id
         FROM departments
         WHERE department_name=?
         AND id<>?`,
        [
            name,
            id
        ],
        (err, duplicateResult) => {

            if (err) {
                console.error(err);

                return res.status(500).json({
                    success: false,
                    message: "Database Error"
                });
            }

            if (duplicateResult.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: "Department already exists."
                });
            }

            db.query(
                `UPDATE departments
                 SET department_name=?
                 WHERE id=?`,
                [
                    name,
                    id
                ],
                (err, result) => {

                    if (err) {
                        console.error(err);

                        return res.status(500).json({
                            success: false,
                            message: "Database Error"
                        });
                    }

                    if (result.affectedRows === 0) {
                        return res.status(404).json({
                            success: false,
                            message: "Department not found."
                        });
                    }

                    return res.json({
                        success: true,
                        message: "Department updated successfully."
                    });

                }
            );

        }
    );
};



// Delete Department
// SUPER_ADMIN ONLY


exports.deleteDepartment = (req, res) => {

    const { id } = req.params;

    // Check classes
    db.query(
        `SELECT id
         FROM classes
         WHERE department_id=?
         LIMIT 1`,
        [id],
        (err, classResult) => {

            if (err) {
                console.error(err);

                return res.status(500).json({
                    success: false,
                    message: "Database Error"
                });
            }

            if (classResult.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: "Department contains classes. Remove or move the classes first."
                });
            }

            // Check department management assignments
            db.query(
                `SELECT id
                 FROM department_management
                 WHERE department_id=?
                 LIMIT 1`,
                [id],
                (err, assignmentResult) => {

                    if (err) {
                        console.error(err);

                        return res.status(500).json({
                            success: false,
                            message: "Database Error"
                        });
                    }

                    if (assignmentResult.length > 0) {
                        return res.status(400).json({
                            success: false,
                            message: "Department is assigned to one or more Department Admins."
                        });
                    }

                    // Delete department
                    db.query(
                        `DELETE FROM departments
                         WHERE id=?`,
                        [id],
                        (err, result) => {

                            if (err) {
                                console.error(err);

                                return res.status(500).json({
                                    success: false,
                                    message: "Database Error"
                                });
                            }

                            if (result.affectedRows === 0) {
                                return res.status(404).json({
                                    success: false,
                                    message: "Department not found."
                                });
                            }

                            return res.json({
                                success: true,
                                message: "Department deleted successfully."
                            });

                        }
                    );

                }
            );

        }
    );
};



// Give Department Admin Privilege
// SUPER_ADMIN ONLY


exports.makeDepartmentAdmin = (req, res) => {

    const { teacher_id } = req.params;

    db.query(
        `SELECT id
         FROM users
         WHERE id=?
         AND role='TEACHER'
         AND is_active=1`,
        [teacher_id],
        (err, teacherResult) => {

            if (err) {
                console.error(err);

                return res.status(500).json({
                    success: false,
                    message: "Database Error"
                });
            }

            if (teacherResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Active teacher not found."
                });
            }

            db.query(
                `UPDATE users
                 SET is_department_admin=1
                 WHERE id=?
                 AND role='TEACHER'`,
                [teacher_id],
                (err, result) => {

                    if (err) {
                        console.error(err);

                        return res.status(500).json({
                            success: false,
                            message: "Database Error"
                        });
                    }

                    return res.json({
                        success: true,
                        message: "Department Admin assigned successfully."
                    });

                }
            );

        }
    );
};



// Remove Department Admin Privilege
// SUPER_ADMIN ONLY


exports.removeDepartmentAdmin = (req, res) => {

    const { teacher_id } = req.params;

    db.query(
        `UPDATE users
         SET is_department_admin=0
         WHERE id=?
         AND role='TEACHER'`,
        [teacher_id],
        (err, result) => {

            if (err) {
                console.error(err);

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
                message: "Department Admin removed successfully."
            });

        }
    );
};



// Assign Department To Department Admin
// SUPER_ADMIN ONLY


exports.assignDepartment = (req, res) => {

    const {
        teacher_id,
        department_id
    } = req.body;

    if (!teacher_id || !department_id) {
        return res.status(400).json({
            success: false,
            message: "Teacher ID and Department ID are required."
        });
    }


    // Check teacher
    db.query(
        `SELECT id
         FROM users
         WHERE id=?
         AND role='TEACHER'
         AND is_active=1`,
        [teacher_id],
        (err, teacherResult) => {

            if (err) {
                console.error(err);

                return res.status(500).json({
                    success: false,
                    message: "Database Error"
                });
            }

            if (teacherResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Active teacher not found."
                });
            }


            // Check department
            db.query(
                `SELECT id
                 FROM departments
                 WHERE id=?`,
                [department_id],
                (err, departmentResult) => {

                    if (err) {
                        console.error(err);

                        return res.status(500).json({
                            success: false,
                            message: "Database Error"
                        });
                    }

                    if (departmentResult.length === 0) {
                        return res.status(404).json({
                            success: false,
                            message: "Department not found."
                        });
                    }


                    // Check duplicate assignment
                    db.query(
                        `SELECT id
                         FROM department_management
                         WHERE teacher_id=?
                         AND department_id=?`,
                        [
                            teacher_id,
                            department_id
                        ],
                        (err, existingResult) => {

                            if (err) {
                                console.error(err);

                                return res.status(500).json({
                                    success: false,
                                    message: "Database Error"
                                });
                            }

                            if (existingResult.length > 0) {
                                return res.status(400).json({
                                    success: false,
                                    message: "Department is already assigned to this teacher."
                                });
                            }


                            // Assign department
                            db.query(
                                `INSERT INTO department_management
                                (
                                    teacher_id,
                                    department_id
                                )
                                VALUES (?, ?)`,
                                [
                                    teacher_id,
                                    department_id
                                ],
                                (err, result) => {

                                    if (err) {
                                        console.error(err);

                                        return res.status(500).json({
                                            success: false,
                                            message: "Database Error"
                                        });
                                    }

                                    return res.status(201).json({
                                        success: true,
                                        message: "Department assigned successfully.",
                                        id: result.insertId
                                    });

                                }
                            );

                        }
                    );

                }
            );

        }
    );
};



// View Department Assignments
// SUPER_ADMIN ONLY


exports.getDepartmentAssignments = (req, res) => {

    const sql = `
        SELECT
            dm.id,
            dm.teacher_id,
            dm.department_id,
            u.full_name,
            u.email,
            d.department_name
        FROM department_management dm

        JOIN users u
            ON dm.teacher_id=u.id

        JOIN departments d
            ON dm.department_id=d.id

        ORDER BY
            u.full_name ASC,
            d.department_name ASC
    `;

    db.query(
        sql,
        (err, results) => {

            if (err) {
                console.error(err);

                return res.status(500).json({
                    success: false,
                    message: "Database Error"
                });
            }

            return res.json({
                success: true,
                assignments: results
            });

        }
    );
};