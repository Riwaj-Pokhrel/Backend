const db = require("../config/db");
const bcrypt = require("bcrypt");



// Create Student

exports.createStudent = async (req, res) => {

    const {
        full_name,
        email,
        password,
        roll_no,
        class_id
    } = req.body;

    if (!full_name || !email || !password || !roll_no || !class_id) {
        return res.status(400).json({
            success: false,
            message: "All fields are required."
        });
    }


    
    // Check class and department access
    
    let classSql = `
        SELECT c.id
        FROM classes c
        WHERE c.id=?
    `;

    let classParams = [class_id];


    // Department Admin can only use
    // classes in their managed departments
    if (
        req.user.role === "TEACHER" &&
        Number(req.user.is_department_admin) === 1
    ) {

        classSql = `
            SELECT c.id
            FROM classes c
            JOIN department_management dm
                ON c.department_id = dm.department_id
            WHERE c.id=?
            AND dm.teacher_id=?
        `;

        classParams = [class_id, req.user.id];
    }


    db.query(
        classSql,
        classParams,
        async (err, classResult) => {

            if (err) {
                console.error(err);

                return res.status(500).json({
                    success: false,
                    message: "Database Error"
                });
            }

            if (classResult.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: "Class not found or access denied."
                });
            }


            
            // Check duplicate email
            
            db.query(
                "SELECT id FROM users WHERE email=?",
                [email],
                async (err, emailResult) => {

                    if (err) {
                        return res.status(500).json({
                            success: false,
                            message: "Database Error"
                        });
                    }

                    if (emailResult.length > 0) {
                        return res.status(400).json({
                            success: false,
                            message: "Email already exists."
                        });
                    }


                    
                    // Check duplicate roll number
                    
                    db.query(
                        "SELECT id FROM users WHERE roll_no=?",
                        [roll_no],
                        async (err, rollResult) => {

                            if (err) {
                                return res.status(500).json({
                                    success: false,
                                    message: "Database Error"
                                });
                            }

                            if (rollResult.length > 0) {
                                return res.status(400).json({
                                    success: false,
                                    message: "Roll number already exists."
                                });
                            }


                            
                            // Hash password
                            
                            const hashedPassword =
                                await bcrypt.hash(password, 10);


                            
                            // Create User
                            
                            db.query(
                                `INSERT INTO users
                                (
                                    full_name,
                                    email,
                                    password,
                                    role,
                                    is_department_admin,
                                    roll_no,
                                    is_active
                                )
                                VALUES(?,?,?,?,?,?,?)`,
                                [
                                    full_name,
                                    email,
                                    hashedPassword,
                                    "STUDENT",
                                    0,
                                    roll_no,
                                    1
                                ],
                                (err, userResult) => {

                                    if (err) {
                                        console.error(err);

                                        return res.status(500).json({
                                            success: false,
                                            message: "Database Error"
                                        });
                                    }


                                    
                                    // Assign Student to Class
                                    
                                    db.query(
                                        `INSERT INTO student_classes
                                        (
                                            student_id,
                                            class_id
                                        )
                                        VALUES(?,?)`,
                                        [
                                            userResult.insertId,
                                            class_id
                                        ],
                                        (err) => {

                                            if (err) {
                                                console.error(err);

                                                return res.status(500).json({
                                                    success: false,
                                                    message: "Database Error"
                                                });
                                            }

                                            return res.status(201).json({
                                                success: true,
                                                message: "Student created successfully."
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

};



// View All Students

exports.getAllStudents = (req, res) => {

    let sql = `
        SELECT
            u.id,
            u.full_name,
            u.roll_no,
            u.email,
            c.class_name,
            c.department_id,
            d.department_name,
            u.is_active
        FROM users u
        JOIN student_classes sc
            ON u.id = sc.student_id
        JOIN classes c
            ON sc.class_id = c.id
        JOIN departments d
            ON c.department_id = d.id
        WHERE u.role='STUDENT'
    `;

    let params = [];


    
    // Department Admin:
    // only students from managed departments
    
    if (
        req.user.role === "TEACHER" &&
        Number(req.user.is_department_admin) === 1
    ) {

        sql += `
            AND EXISTS (
                SELECT 1
                FROM department_management dm
                WHERE dm.department_id = c.department_id
                AND dm.teacher_id = ?
            )
        `;

        params.push(req.user.id);
    }


    sql += `
        ORDER BY u.roll_no ASC
    `;


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
                students: results
            });

        }
    );

};



// View Students By Class

exports.getStudentsByClass = (req, res) => {

    const { class_id } = req.params;


    let sql = `
        SELECT
            u.id,
            u.full_name,
            u.roll_no,
            u.email,
            u.is_active
        FROM users u
        JOIN student_classes sc
            ON u.id = sc.student_id
        JOIN classes c
            ON sc.class_id = c.id
        WHERE sc.class_id=?
        AND u.role='STUDENT'
    `;

    let params = [class_id];


    
    // Department Admin:
    // only managed department
    
    if (
        req.user.role === "TEACHER" &&
        Number(req.user.is_department_admin) === 1
    ) {

        sql += `
            AND EXISTS (
                SELECT 1
                FROM department_management dm
                WHERE dm.department_id = c.department_id
                AND dm.teacher_id = ?
            )
        `;

        params.push(req.user.id);
    }


    sql += `
        ORDER BY u.roll_no ASC
    `;


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
                students: results
            });

        }
    );

};



// Update Student

exports.updateStudent = (req, res) => {

    const { id } = req.params;

    const {
        full_name,
        email,
        roll_no,
        class_id
    } = req.body;

    if (!full_name || !email || !roll_no || !class_id) {
        return res.status(400).json({
            success: false,
            message: "All fields are required."
        });
    }


    
    // Check target class access
    
    let classSql = `
        SELECT id
        FROM classes
        WHERE id=?
    `;

    let classParams = [class_id];


    if (
        req.user.role === "TEACHER" &&
        Number(req.user.is_department_admin) === 1
    ) {

        classSql = `
            SELECT c.id
            FROM classes c
            JOIN department_management dm
                ON c.department_id = dm.department_id
            WHERE c.id=?
            AND dm.teacher_id=?
        `;

        classParams = [class_id, req.user.id];
    }


    db.query(
        classSql,
        classParams,
        (err, classResult) => {

            if (err) {
                return res.status(500).json({
                    success: false,
                    message: "Database Error"
                });
            }

            if (classResult.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: "Class not found or access denied."
                });
            }


            
            // Department Admin:
            // verify current student's department
            
            const checkCurrentStudentAccess = (callback) => {

                if (
                    req.user.role === "SUPER_ADMIN"
                ) {
                    return callback(null);
                }


                db.query(
                    `SELECT u.id
                     FROM users u
                     JOIN student_classes sc
                         ON u.id = sc.student_id
                     JOIN classes c
                         ON sc.class_id = c.id
                     JOIN department_management dm
                         ON c.department_id = dm.department_id
                     WHERE u.id=?
                     AND u.role='STUDENT'
                     AND dm.teacher_id=?`,
                    [id, req.user.id],
                    (err, result) => {

                        if (err) {
                            return callback(err);
                        }

                        if (result.length === 0) {
                            return res.status(403).json({
                                success: false,
                                message: "You do not have access to this student."
                            });
                        }

                        callback(null);
                    }
                );

            };


            checkCurrentStudentAccess((err) => {

                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: "Database Error"
                    });
                }


                
                // Check duplicate email
                
                db.query(
                    "SELECT id FROM users WHERE email=? AND id<>?",
                    [email, id],
                    (err, emailResult) => {

                        if (err) {
                            return res.status(500).json({
                                success: false,
                                message: "Database Error"
                            });
                        }

                        if (emailResult.length > 0) {
                            return res.status(400).json({
                                success: false,
                                message: "Email already exists."
                            });
                        }


                        
                        // Check duplicate roll number
                        
                        db.query(
                            "SELECT id FROM users WHERE roll_no=? AND id<>?",
                            [roll_no, id],
                            (err, rollResult) => {

                                if (err) {
                                    return res.status(500).json({
                                        success: false,
                                        message: "Database Error"
                                    });
                                }

                                if (rollResult.length > 0) {
                                    return res.status(400).json({
                                        success: false,
                                        message: "Roll number already exists."
                                    });
                                }


                                
                                // Update user
                                
                                db.query(
                                    `UPDATE users
                                     SET full_name=?,
                                         email=?,
                                         roll_no=?
                                     WHERE id=?
                                     AND role='STUDENT'`,
                                    [
                                        full_name,
                                        email,
                                        roll_no,
                                        id
                                    ],
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
                                                message: "Student not found."
                                            });
                                        }


                                        
                                        // Update Student Class
                                        
                                        db.query(
                                            `UPDATE student_classes
                                             SET class_id=?
                                             WHERE student_id=?`,
                                            [
                                                class_id,
                                                id
                                            ],
                                            (err) => {

                                                if (err) {
                                                    return res.status(500).json({
                                                        success: false,
                                                        message: "Database Error"
                                                    });
                                                }

                                                return res.json({
                                                    success: true,
                                                    message: "Student updated successfully."
                                                });

                                            }
                                        );

                                    }
                                );

                            }
                        );

                    }
                );

            });

        }
    );

};



// Activate / Deactivate Student

exports.toggleStudentStatus = (req, res) => {

    const { id } = req.params;


    let sql = `
        UPDATE users u
        SET u.is_active = NOT u.is_active
        WHERE u.id=?
        AND u.role='STUDENT'
    `;

    let params = [id];


    
    // Department Admin:
    // only students in managed departments
    
    if (
        req.user.role === "TEACHER" &&
        Number(req.user.is_department_admin) === 1
    ) {

        sql = `
            UPDATE users u
            JOIN student_classes sc
                ON u.id = sc.student_id
            JOIN classes c
                ON sc.class_id = c.id
            JOIN department_management dm
                ON c.department_id = dm.department_id
            SET u.is_active = NOT u.is_active
            WHERE u.id=?
            AND u.role='STUDENT'
            AND dm.teacher_id=?
        `;

        params = [id, req.user.id];
    }


    db.query(
        sql,
        params,
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
                    message: "Student not found or access denied."
                });
            }

            return res.json({
                success: true,
                message: "Student status updated successfully."
            });

        }
    );

};



// Reset Student Password

//
// Admin-initiated password reset (no self-service "forgot
// password" flow exists, since there's no email infrastructure
// in this project). Super Admin can reset any student's password;
// a Department Admin can reset it only for students within their
// managed departments, same scoping as toggleStudentStatus above.
// The admin sets the new password directly and relays it to the
// student out-of-band; the student can change it afterward via
// their own Change Password screen.


exports.resetStudentPassword = async (req, res) => {

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


    let sql = `
        UPDATE users u
        SET u.password=?
        WHERE u.id=?
        AND u.role='STUDENT'
    `;

    let params = [hashedPassword, id];


    
    // Department Admin:
    // only students in managed departments
    
    if (
        req.user.role === "TEACHER" &&
        Number(req.user.is_department_admin) === 1
    ) {

        sql = `
            UPDATE users u
            JOIN student_classes sc
                ON u.id = sc.student_id
            JOIN classes c
                ON sc.class_id = c.id
            JOIN department_management dm
                ON c.department_id = dm.department_id
            SET u.password=?
            WHERE u.id=?
            AND u.role='STUDENT'
            AND dm.teacher_id=?
        `;

        params = [hashedPassword, id, req.user.id];
    }


    db.query(
        sql,
        params,
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
                    message: "Student not found or access denied."
                });
            }

            return res.json({
                success: true,
                message: "Student password reset successfully."
            });

        }
    );

};



// Search Student

exports.searchStudent = (req, res) => {

    const { roll_no } = req.params;

    let sql = `
        SELECT
            u.id,
            u.full_name,
            u.roll_no,
            u.email,
            c.class_name,
            c.department_id,
            d.department_name,
            u.is_active
        FROM users u
        JOIN student_classes sc
            ON u.id = sc.student_id
        JOIN classes c
            ON sc.class_id = c.id
        JOIN departments d
            ON c.department_id = d.id
        WHERE u.role='STUDENT'
        AND u.roll_no LIKE ?
    `;

    let params = [`%${roll_no}%`];


    
    // Department Admin:
    // search only managed departments
    
    if (
        req.user.role === "TEACHER" &&
        Number(req.user.is_department_admin) === 1
    ) {

        sql += `
            AND EXISTS (
                SELECT 1
                FROM department_management dm
                WHERE dm.department_id = c.department_id
                AND dm.teacher_id = ?
            )
        `;

        params.push(req.user.id);
    }


    sql += `
        ORDER BY u.roll_no ASC
    `;


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
                students: results
            });

        }
    );

};