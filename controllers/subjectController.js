const db = require("../config/db");



// Helper:
// Check whether user can access a class


const checkClassAccess = (req, class_id, callback) => {

    // SUPER_ADMIN has access to everything
    if (req.user.role === "SUPER_ADMIN") {
        return callback(null, true);
    }


    // Only Department Admin can manage subjects
    if (
        req.user.role !== "TEACHER" ||
        Number(req.user.is_department_admin) !== 1
    ) {
        return callback(null, false);
    }


    // Check whether Department Admin
    // manages the department of this class
    db.query(
        `SELECT c.id
         FROM classes c
         JOIN department_management dm
             ON c.department_id = dm.department_id
         WHERE c.id = ?
         AND dm.teacher_id = ?
         AND c.is_active = 1`,
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



// Helper:
// Check whether user can access subject


const checkSubjectAccess = (req, subject_id, callback) => {

    // SUPER_ADMIN has access to everything
    if (req.user.role === "SUPER_ADMIN") {
        return callback(null, true);
    }


    // Only Department Admin can manage subjects
    if (
        req.user.role !== "TEACHER" ||
        Number(req.user.is_department_admin) !== 1
    ) {
        return callback(null, false);
    }


    // Find the class belonging to the subject
    // and check its department
    db.query(
        `SELECT s.id
         FROM subjects s
         JOIN classes c
             ON s.class_id = c.id
         JOIN department_management dm
             ON c.department_id = dm.department_id
         WHERE s.id = ?
         AND dm.teacher_id = ?`,
        [
            subject_id,
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



// Create Subject


exports.createSubject = (req, res) => {

    const {
        subject_name,
        class_id
    } = req.body;


    if (!subject_name || !class_id) {
        return res.status(400).json({
            success: false,
            message: "All fields are required."
        });
    }


    checkClassAccess(
        req,
        class_id,
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
                    message: "You do not have permission to manage subjects in this class."
                });
            }


            // Check class exists and is active
            db.query(
                `SELECT id
                 FROM classes
                 WHERE id = ?
                 AND is_active = 1`,
                [class_id],
                (err, classResult) => {

                    if (err) {
                        console.error(err);

                        return res.status(500).json({
                            success: false,
                            message: "Database Error"
                        });
                    }


                    if (classResult.length === 0) {
                        return res.status(400).json({
                            success: false,
                            message: "Class not found or inactive."
                        });
                    }


                    // Create subject
                    db.query(
                        `INSERT INTO subjects
                        (
                            subject_name,
                            class_id,
                            is_archived
                        )
                        VALUES (?, ?, 0)`,
                        [
                            subject_name,
                            class_id
                        ],
                        (err, result) => {

                            if (err) {

                                if (err.code === "ER_DUP_ENTRY") {
                                    return res.status(400).json({
                                        success: false,
                                        message: "Subject already exists in this class."
                                    });
                                }


                                console.error(err);

                                return res.status(500).json({
                                    success: false,
                                    message: "Database Error"
                                });
                            }


                            return res.status(201).json({
                                success: true,
                                message: "Subject created successfully.",
                                id: result.insertId
                            });

                        }
                    );

                }
            );

        }
    );
};



// View All Subjects


exports.getAllSubjects = (req, res) => {

    let sql = `
        SELECT
            s.id,
            s.subject_name,
            c.id AS class_id,
            c.class_name,
            c.department_id,
            d.department_name,
            s.is_archived
        FROM subjects s
        JOIN classes c
            ON s.class_id = c.id
        JOIN departments d
            ON c.department_id = d.id
    `;

    const params = [];


    // SUPER_ADMIN
    if (req.user.role === "SUPER_ADMIN") {

        sql += `
            ORDER BY
                c.class_name,
                s.subject_name
        `;

    }


    // Department Admin
    else if (
        req.user.role === "TEACHER" &&
        Number(req.user.is_department_admin) === 1
    ) {

        sql = `
            SELECT
                s.id,
                s.subject_name,
                c.id AS class_id,
                c.class_name,
                c.department_id,
                d.department_name,
                s.is_archived
            FROM subjects s

            JOIN classes c
                ON s.class_id = c.id

            JOIN departments d
                ON c.department_id = d.id

            JOIN department_management dm
                ON c.department_id = dm.department_id

            WHERE dm.teacher_id = ?

            ORDER BY
                c.class_name,
                s.subject_name
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
                subjects: results
            });

        }
    );
};



// View Subjects By Class


exports.getSubjectsByClass = (req, res) => {

    const {
        class_id
    } = req.params;


    checkClassAccess(
        req,
        class_id,
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
                    message: "You do not have permission to view subjects in this class."
                });
            }


            const sql = `
                SELECT
                    id,
                    subject_name,
                    class_id,
                    is_archived
                FROM subjects
                WHERE class_id = ?
                ORDER BY subject_name
            `;


            db.query(
                sql,
                [class_id],
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
                        subjects: results
                    });

                }
            );

        }
    );
};



// Update Subject


exports.updateSubject = (req, res) => {

    const {
        id
    } = req.params;


    const {
        subject_name,
        class_id
    } = req.body;


    if (!subject_name || !class_id) {
        return res.status(400).json({
            success: false,
            message: "All fields are required."
        });
    }


    // Check current subject access
    checkSubjectAccess(
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
                    message: "You do not have permission to update this subject."
                });
            }


            // Check new class access
            checkClassAccess(
                req,
                class_id,
                (err, newClassAccess) => {

                    if (err) {
                        console.error(err);

                        return res.status(500).json({
                            success: false,
                            message: "Database Error"
                        });
                    }


                    if (!newClassAccess) {
                        return res.status(403).json({
                            success: false,
                            message: "You do not have permission to move the subject to this class."
                        });
                    }


                    // Check class exists and active
                    db.query(
                        `SELECT id
                         FROM classes
                         WHERE id = ?
                         AND is_active = 1`,
                        [class_id],
                        (err, classResult) => {

                            if (err) {
                                console.error(err);

                                return res.status(500).json({
                                    success: false,
                                    message: "Database Error"
                                });
                            }


                            if (classResult.length === 0) {
                                return res.status(400).json({
                                    success: false,
                                    message: "Class not found or inactive."
                                });
                            }


                            // Update subject
                            db.query(
                                `UPDATE subjects
                                 SET subject_name = ?,
                                     class_id = ?
                                 WHERE id = ?`,
                                [
                                    subject_name,
                                    class_id,
                                    id
                                ],
                                (err, result) => {

                                    if (err) {

                                        if (err.code === "ER_DUP_ENTRY") {
                                            return res.status(400).json({
                                                success: false,
                                                message: "Subject already exists in this class."
                                            });
                                        }


                                        console.error(err);

                                        return res.status(500).json({
                                            success: false,
                                            message: "Database Error"
                                        });
                                    }


                                    if (result.affectedRows === 0) {
                                        return res.status(404).json({
                                            success: false,
                                            message: "Subject not found."
                                        });
                                    }


                                    return res.json({
                                        success: true,
                                        message: "Subject updated successfully."
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



// Archive / Activate Subject


exports.toggleArchiveSubject = (req, res) => {

    const {
        id
    } = req.params;


    checkSubjectAccess(
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
                    message: "You do not have permission to change this subject."
                });
            }


            db.query(
                `UPDATE subjects
                 SET is_archived = NOT is_archived
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
                            message: "Subject not found."
                        });
                    }


                    return res.json({
                        success: true,
                        message: "Subject archive status updated successfully."
                    });

                }
            );

        }
    );
};



// View Archived Subjects


exports.getArchivedSubjects = (req, res) => {

    let sql = `
        SELECT
            s.id,
            s.subject_name,
            c.id AS class_id,
            c.class_name,
            d.department_name
        FROM subjects s

        JOIN classes c
            ON s.class_id = c.id

        JOIN departments d
            ON c.department_id = d.id

        WHERE s.is_archived = 1
    `;

    const params = [];


    // SUPER_ADMIN
    if (req.user.role === "SUPER_ADMIN") {

        sql += `
            ORDER BY
                c.class_name,
                s.subject_name
        `;

    }


    // Department Admin
    else if (
        req.user.role === "TEACHER" &&
        Number(req.user.is_department_admin) === 1
    ) {

        sql = `
            SELECT
                s.id,
                s.subject_name,
                c.id AS class_id,
                c.class_name,
                d.department_name
            FROM subjects s

            JOIN classes c
                ON s.class_id = c.id

            JOIN departments d
                ON c.department_id = d.id

            JOIN department_management dm
                ON c.department_id = dm.department_id

            WHERE s.is_archived = 1
            AND dm.teacher_id = ?

            ORDER BY
                c.class_name,
                s.subject_name
        `;

        params.push(req.user.id);

    }


    // Others
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
                        subjects: results
                    });

                }
            );
        };
