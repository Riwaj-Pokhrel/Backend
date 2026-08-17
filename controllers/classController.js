const db = require("../config/db");


// Helper: Check whether user can access a class

const checkClassAccess = (req, class_id, callback) => {

    // SUPER_ADMIN has access to everything
    if (req.user.role === "SUPER_ADMIN") {
        return callback(null, true);
    }

    // Only Department Admin can manage classes
    if (
        req.user.role !== "TEACHER" ||
        Number(req.user.is_department_admin) !== 1
    ) {
        return callback(null, false);
    }

    // Check whether Department Admin manages
    // the department of this class
    db.query(
        `SELECT c.id
         FROM classes c
         JOIN department_management dm
             ON c.department_id = dm.department_id
         WHERE c.id=?
         AND dm.teacher_id=?`,
        [
            class_id,
            req.user.id
        ],
        (err, result) => {

            if (err) {
                return callback(err);
            }

            callback(null, result.length > 0);
        }
    );
};


// Create Class

exports.createClass = (req, res) => {

    const {
        class_name,
        department_id
    } = req.body;

    if (!class_name || !department_id) {
        return res.status(400).json({
            success: false,
            message: "All fields are required."
        });
    }


    // Department Admin must manage the department
    if (
        req.user.role === "TEACHER" &&
        Number(req.user.is_department_admin) === 1
    ) {

        db.query(
            `SELECT id
             FROM department_management
             WHERE teacher_id=?
             AND department_id=?`,
            [
                req.user.id,
                department_id
            ],
            (err, accessResult) => {

                if (err) {
                    console.error(err);

                    return res.status(500).json({
                        success: false,
                        message: "Database Error"
                    });
                }

                if (accessResult.length === 0) {
                    return res.status(403).json({
                        success: false,
                        message: "You do not have permission to create a class in this department."
                    });
                }

                insertClass();
            }
        );

    } else if (req.user.role === "SUPER_ADMIN") {

        insertClass();

    } else {

        return res.status(403).json({
            success: false,
            message: "Access denied."
        });
    }


   
    // Insert Class
   

    function insertClass() {

        // Check department exists
        db.query(
            `SELECT id
             FROM departments
             WHERE id=?`,
            [department_id],
            (err, deptResult) => {

                if (err) {
                    console.error(err);

                    return res.status(500).json({
                        success: false,
                        message: "Database Error"
                    });
                }

                if (deptResult.length === 0) {
                    return res.status(400).json({
                        success: false,
                        message: "Department not found."
                    });
                }


                // Check duplicate class
                db.query(
                    `SELECT id
                     FROM classes
                     WHERE class_name=?`,
                    [class_name],
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
                                message: "Class already exists."
                            });
                        }


                        // Insert class
                        db.query(
                            `INSERT INTO classes
                            (
                                class_name,
                                department_id,
                                is_active
                            )
                            VALUES(?,?,?)`,
                            [
                                class_name,
                                department_id,
                                1
                            ],
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
                                    message: "Class created successfully.",
                                    id: insertResult.insertId
                                });

                            }
                        );

                    }
                );

            }
        );

    }
};


// View Classes

exports.getAllClasses = (req, res) => {

    let sql = `
        SELECT
            c.id,
            c.class_name,
            c.department_id,
            d.department_name,
            c.is_active
        FROM classes c
        JOIN departments d
            ON c.department_id=d.id
    `;

    const params = [];


    // SUPER_ADMIN sees everything
    if (req.user.role === "SUPER_ADMIN") {

        sql += `
            ORDER BY c.class_name
        `;

    }

    // Department Admin sees only managed departments
    else if (
        req.user.role === "TEACHER" &&
        Number(req.user.is_department_admin) === 1
    ) {

        sql += `
            JOIN department_management dm
                ON c.department_id=dm.department_id
            WHERE dm.teacher_id=?
            ORDER BY c.class_name
        `;

        params.push(req.user.id);

    }

    // Normal Teacher / Student
    else {

        return res.status(403).json({
            success: false,
            message: "Access denied."
        });
    }


    db.query(
        sql,
        params,
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
                classes: results
            });

        }
    );
};


// Update Class

exports.updateClass = (req, res) => {

    const { id } = req.params;

    const {
        class_name,
        department_id
    } = req.body;


    if (!class_name || !department_id) {
        return res.status(400).json({
            success: false,
            message: "All fields are required."
        });
    }


    // Check current class access
    checkClassAccess(
        req,
        id,
        (err, hasAccess) => {

            if (err) {
                console.error(err);

                return res.status(500).json({
                    success: false,
                    message: "Database Error"
                });
            }


            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    message: "You do not have permission to update this class."
                });
            }


            // Department Admin must also manage
            // the NEW department
            if (
                req.user.role === "TEACHER" &&
                Number(req.user.is_department_admin) === 1
            ) {

                db.query(
                    `SELECT id
                     FROM department_management
                     WHERE teacher_id=?
                     AND department_id=?`,
                    [
                        req.user.id,
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


                        if (result.length === 0) {
                            return res.status(403).json({
                                success: false,
                                message: "You do not manage the selected department."
                            });
                        }


                        performUpdate();
                    }
                );

            } else {

                performUpdate();

            }


            function performUpdate() {

                db.query(
                    `UPDATE classes
                     SET class_name=?,
                         department_id=?
                     WHERE id=?`,
                    [
                        class_name,
                        department_id,
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
                                message: "Class not found."
                            });
                        }


                        return res.json({
                            success: true,
                            message: "Class updated successfully."
                        });

                    }
                );

            }

        }
    );
};


// Archive / Activate Class

exports.toggleClassStatus = (req, res) => {

    const { id } = req.params;


    // Check access
    checkClassAccess(
        req,
        id,
        (err, hasAccess) => {

            if (err) {
                console.error(err);

                return res.status(500).json({
                    success: false,
                    message: "Database Error"
                });
            }


            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    message: "You do not have permission to change this class status."
                });
            }


            db.query(
                `UPDATE classes
                 SET is_active = NOT is_active
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
                            message: "Class not found."
                        });
                    }


                    return res.json({
                        success: true,
                        message: "Class status updated successfully."
                    });

                }
            );

        }
    );
};


// Delete Class


exports.deleteClass = (req, res) => {

    const { id } = req.params;

    checkClassAccess(
        req,
        id,
        (err, hasAccess) => {

            if (err) {
                console.error(err);

                return res.status(500).json({
                    success: false,
                    message: "Database Error"
                });
            }

            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    message: "You do not have permission to delete this class."
                });
            }


            // 1. Attendance records for sessions under this class
            db.query(
                `DELETE a
                 FROM attendance a
                 JOIN attendance_sessions ats
                     ON a.attendance_session_id = ats.id
                 JOIN teacher_assignments ta
                     ON ats.teacher_assignment_id = ta.id
                 WHERE ta.class_id = ?`,
                [id],
                (err) => {

                    if (err) {
                        console.error(err);

                        return res.status(500).json({
                            success: false,
                            message: "Database Error"
                        });
                    }


                    // 2. Attendance sessions under this class
                    db.query(
                        `DELETE ats
                         FROM attendance_sessions ats
                         JOIN teacher_assignments ta
                             ON ats.teacher_assignment_id = ta.id
                         WHERE ta.class_id = ?`,
                        [id],
                        (err) => {

                            if (err) {
                                console.error(err);

                                return res.status(500).json({
                                    success: false,
                                    message: "Database Error"
                                });
                            }


                            // 3. Teacher assignments for this class
                            db.query(
                                `DELETE FROM teacher_assignments
                                 WHERE class_id = ?`,
                                [id],
                                (err) => {

                                    if (err) {
                                        console.error(err);

                                        return res.status(500).json({
                                            success: false,
                                            message: "Database Error"
                                        });
                                    }


                                    // 4. Subjects belonging to this class
                                    db.query(
                                        `DELETE FROM subjects
                                         WHERE class_id = ?`,
                                        [id],
                                        (err) => {

                                            if (err) {
                                                console.error(err);

                                                return res.status(500).json({
                                                    success: false,
                                                    message: "Database Error"
                                                });
                                            }


                                            // 5. Student enrollment in this class
                                            // (does not delete the student accounts)
                                            db.query(
                                                `DELETE FROM student_classes
                                                 WHERE class_id = ?`,
                                                [id],
                                                (err) => {

                                                    if (err) {
                                                        console.error(err);

                                                        return res.status(500).json({
                                                            success: false,
                                                            message: "Database Error"
                                                        });
                                                    }


                                                    // 6. The class itself
                                                    db.query(
                                                        `DELETE FROM classes
                                                         WHERE id = ?`,
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
                                                                    message: "Class not found."
                                                                });
                                                            }

                                                            return res.json({
                                                                success: true,
                                                                message: "Class and all associated data deleted successfully."
                                                            });

                                                        }
                                                    );

                                                }
                                            );

                                        }
                                    );

                                }
                            );

                        }
                    );

                }
            );

        }
    );
};