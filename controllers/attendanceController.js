const db = require("../config/db");



// Check whether user can access an attendance session

const checkSessionAccess = (req, attendance_session_id, callback) => {

    // SUPER_ADMIN has unrestricted access
    if (req.user.role === "SUPER_ADMIN") {
        return callback(null, true);
    }


    // Normal teacher:
    // session must belong to their assignment
    if (req.user.role !== "TEACHER") {
        return callback(null, false);
    }


    db.query(
        `SELECT ats.id
         FROM attendance_sessions ats

         JOIN teacher_assignments ta
             ON ats.teacher_assignment_id = ta.id

         WHERE ats.id=?
         AND ta.teacher_id=?`,
        [
            attendance_session_id,
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



// Check whether user can access an assignment

const checkAssignmentAccess = (req, teacher_assignment_id, callback) => {

    // SUPER_ADMIN
    if (req.user.role === "SUPER_ADMIN") {
        return callback(null, true);
    }


    // Teacher can only access own assignment
    if (req.user.role !== "TEACHER") {
        return callback(null, false);
    }


    db.query(
        `SELECT id
         FROM teacher_assignments
         WHERE id=?
         AND teacher_id=?
         AND is_active=1`,
        [
            teacher_assignment_id,
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



// Start Attendance Session

exports.startAttendance = (req, res) => {

    const {
        teacher_assignment_id
    } = req.body;


    if (!teacher_assignment_id) {
        return res.status(400).json({
            success: false,
            message: "Teacher assignment ID is required."
        });
    }


    // Check whether current user owns the assignment
    checkAssignmentAccess(
        req,
        teacher_assignment_id,
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
                    message: "You do not have permission to start attendance for this assignment."
                });
            }


            // Start today's session
            db.query(
                `INSERT INTO attendance_sessions
                (
                    teacher_assignment_id,
                    attendance_date
                )
                VALUES (?, CURDATE())`,
                [
                    teacher_assignment_id
                ],
                (err, result) => {

                    if (err) {

                        if (err.code === "ER_DUP_ENTRY") {
                            return res.status(400).json({
                                success: false,
                                message: "Attendance session already exists for today."
                            });
                        }


                        console.error(err);

                        return res.status(500).json({
                            success: false,
                            message: "Database Error"
                        });
                    }


                    const attendance_session_id =
                        result.insertId;


                    return res.status(201).json({
                        success: true,
                        message: "Attendance session started successfully.",
                        id: attendance_session_id
                    });

                }
            );

        }
    );

};



// Get Today's Sessions For Current Teacher

exports.getTodaySessions = (req, res) => {

    let sql = `
        SELECT
            ats.id AS attendance_session_id,
            ta.id AS teacher_assignment_id,
            ta.teacher_id,
            c.class_name,
            s.subject_name,
            ta.day,
            ta.start_time,
            ta.end_time,
            ats.attendance_date

        FROM attendance_sessions ats

        JOIN teacher_assignments ta
            ON ats.teacher_assignment_id = ta.id

        JOIN classes c
            ON ta.class_id = c.id

        JOIN subjects s
            ON ta.subject_id = s.id

        WHERE ats.attendance_date = CURDATE()
    `;


    const params = [];


    // SUPER_ADMIN can see all today's sessions
    if (req.user.role === "SUPER_ADMIN") {

        sql += `
            ORDER BY ats.id DESC
        `;

    }


    // Teacher sees only their sessions
    else if (req.user.role === "TEACHER") {

        sql += `
            AND ta.teacher_id=?
            ORDER BY ats.id DESC
        `;

        params.push(req.user.id);

    }


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
                sessions: results
            });

        }
    );

};



// Get Students For Attendance

exports.getStudentsForAttendance = (req, res) => {

    const {
        attendance_session_id
    } = req.params;


    if (!attendance_session_id) {
        return res.status(400).json({
            success: false,
            message: "Attendance session ID is required."
        });
    }


    // Check session access
    checkSessionAccess(
        req,
        attendance_session_id,
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
                    message: "You do not have permission to access this attendance session."
                });
            }


            const sql = `
                SELECT

                    u.id AS student_id,
                    u.full_name,
                    u.roll_no,

                    a.id AS attendance_id,
                    a.status,
                    a.marked_at

                FROM attendance_sessions ats

                JOIN teacher_assignments ta
                    ON ats.teacher_assignment_id = ta.id

                JOIN student_classes sc
                    ON ta.class_id = sc.class_id

                JOIN users u
                    ON sc.student_id = u.id

                LEFT JOIN attendance a
                    ON ats.id = a.attendance_session_id
                    AND u.id = a.student_id

                WHERE ats.id=?
                AND u.role='STUDENT'
                AND u.is_active=1

                ORDER BY u.roll_no ASC
            `;


            db.query(
                sql,
                [
                    attendance_session_id
                ],
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

        }
    );

};



// Mark Attendance

exports.markAttendance = (req, res) => {

    const {
        attendance_session_id,
        student_id,
        status
    } = req.body;


    if (
        !attendance_session_id ||
        !student_id ||
        !status
    ) {
        return res.status(400).json({
            success: false,
            message: "All fields are required."
        });
    }


    const validStatuses = [
        "PRESENT",
        "ABSENT",
        "LATE",
        "LEAVE"
    ];


    if (!validStatuses.includes(status)) {
        return res.status(400).json({
            success: false,
            message: "Invalid attendance status."
        });
    }


    // Check session access
    checkSessionAccess(
        req,
        attendance_session_id,
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
                    message: "You do not have permission to mark attendance for this session."
                });
            }


            // Check session is for today
            db.query(
                `SELECT
                    ats.id,
                    ta.class_id,
                    ta.subject_id,
                    s.subject_name,
                    c.class_name

                 FROM attendance_sessions ats

                 JOIN teacher_assignments ta
                     ON ats.teacher_assignment_id = ta.id

                 JOIN subjects s
                     ON ta.subject_id = s.id

                 JOIN classes c
                     ON ta.class_id = c.id

                 WHERE ats.id=?
                 AND ats.attendance_date=CURDATE()`,
                [
                    attendance_session_id
                ],
                (err, sessionResult) => {

                    if (err) {
                        console.error(err);

                        return res.status(500).json({
                            success: false,
                            message: "Database Error"
                        });
                    }


                    if (sessionResult.length === 0) {
                        return res.status(400).json({
                            success: false,
                            message: "Attendance session not found or is not for today."
                        });
                    }


                    const class_id =
                        sessionResult[0].class_id;

                    const subject_name =
                        sessionResult[0].subject_name;

                    const class_name =
                        sessionResult[0].class_name;


                    // Check student belongs to this class
                    db.query(
                        `SELECT u.id
                         FROM users u

                         JOIN student_classes sc
                             ON u.id = sc.student_id

                         WHERE u.id=?
                         AND sc.class_id=?
                         AND u.role='STUDENT'
                         AND u.is_active=1`,
                        [
                            student_id,
                            class_id
                        ],
                        (err, studentResult) => {

                            if (err) {
                                console.error(err);

                                return res.status(500).json({
                                    success: false,
                                    message: "Database Error"
                                });
                            }


                            if (studentResult.length === 0) {
                                return res.status(400).json({
                                    success: false,
                                    message: "Student does not belong to this class."
                                });
                            }


                            // Insert attendance
                            db.query(
                                `INSERT INTO attendance
                                (
                                    attendance_session_id,
                                    student_id,
                                    status
                                )
                                VALUES (?, ?, ?)`,
                                [
                                    attendance_session_id,
                                    student_id,
                                    status
                                ],
                                (err, result) => {

                                    if (err) {

                                        if (err.code === "ER_DUP_ENTRY") {
                                            return res.status(400).json({
                                                success: false,
                                                message: "Attendance already marked for this student."
                                            });
                                        }


                                        console.error(err);

                                        return res.status(500).json({
                                            success: false,
                                            message: "Database Error"
                                        });
                                    }


                                    const attendance_id =
                                        result.insertId;


                                    // Create notification for the student
                                    // This is the ONLY attendance notification
                                    const notificationTitle =
                                        "Attendance Marked";


                                    const notificationMessage =
                                        `Your attendance for ${subject_name} in ${class_name} has been marked as ${status}.`;


                                    db.query(
                                        `INSERT INTO notifications
                                        (
                                            user_id,
                                            title,
                                            message
                                        )
                                        VALUES (?, ?, ?)`,
                                        [
                                            student_id,
                                            notificationTitle,
                                            notificationMessage
                                        ],
                                        (notificationErr) => {

                                            // Notification failure should NOT
                                            // invalidate successful attendance.
                                            if (notificationErr) {

                                                console.error(
                                                    "Notification Error:",
                                                    notificationErr
                                                );

                                            }


                                            return res.status(201).json({
                                                success: true,
                                                message: "Attendance marked successfully.",
                                                id: attendance_id
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



// Edit Today's Attendance

exports.updateAttendance = (req, res) => {

    const {
        attendance_id
    } = req.params;


    const {
        status
    } = req.body;


    if (!status) {
        return res.status(400).json({
            success: false,
            message: "Attendance status is required."
        });
    }


    const validStatuses = [
        "PRESENT",
        "ABSENT",
        "LATE",
        "LEAVE"
    ];


    if (!validStatuses.includes(status)) {
        return res.status(400).json({
            success: false,
            message: "Invalid attendance status."
        });
    }


    // Find attendance, session, student, and subject/class names
    db.query(
        `SELECT
            a.id,
            a.student_id,
            ats.id AS attendance_session_id,
            s.subject_name,
            c.class_name

         FROM attendance a

         JOIN attendance_sessions ats
             ON a.attendance_session_id = ats.id

         JOIN teacher_assignments ta
             ON ats.teacher_assignment_id = ta.id

         JOIN subjects s
             ON ta.subject_id = s.id

         JOIN classes c
             ON ta.class_id = c.id

         WHERE a.id=?
         AND ats.attendance_date=CURDATE()`,
        [
            attendance_id
        ],
        (err, attendanceResult) => {

            if (err) {
                console.error(err);

                return res.status(500).json({
                    success: false,
                    message: "Database Error"
                });
            }


            if (attendanceResult.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Attendance not found or cannot be edited."
                });
            }


            const attendance_session_id =
                attendanceResult[0].attendance_session_id;

            const student_id =
                attendanceResult[0].student_id;

            const subject_name =
                attendanceResult[0].subject_name;

            const class_name =
                attendanceResult[0].class_name;


            // Check whether current user can access session
            checkSessionAccess(
                req,
                attendance_session_id,
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
                            message: "You do not have permission to edit this attendance."
                        });
                    }


                    db.query(
                        `UPDATE attendance
                         SET status=?
                         WHERE id=?`,
                        [
                            status,
                            attendance_id
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
                                    message: "Attendance not found."
                                });
                            }


                            // Notify the student of the updated status
                            const notificationTitle =
                                "Attendance Updated";

                            const notificationMessage =
                                `Your attendance for ${subject_name} in ${class_name} was updated to ${status}.`;

                            db.query(
                                `INSERT INTO notifications
                                (
                                    user_id,
                                    title,
                                    message
                                )
                                VALUES (?, ?, ?)`,
                                [
                                    student_id,
                                    notificationTitle,
                                    notificationMessage
                                ],
                                (notificationErr) => {

                                    // Notification failure should NOT
                                    // invalidate a successful update.
                                    if (notificationErr) {

                                        console.error(
                                            "Notification Error:",
                                            notificationErr
                                        );

                                    }


                                    return res.json({
                                        success: true,
                                        message: "Attendance updated successfully."
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



// View Attendance For A Session

exports.getSessionAttendance = (req, res) => {

    const {
        attendance_session_id
    } = req.params;


    if (!attendance_session_id) {
        return res.status(400).json({
            success: false,
            message: "Attendance session ID is required."
        });
    }


    // Check session access
    checkSessionAccess(
        req,
        attendance_session_id,
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
                    message: "You do not have permission to view this attendance session."
                });
            }


            const sql = `
                SELECT

                    a.id AS attendance_id,
                    u.id AS student_id,
                    u.full_name,
                    u.roll_no,
                    a.status,
                    a.marked_at

                FROM attendance a

                JOIN users u
                    ON a.student_id = u.id

                WHERE a.attendance_session_id=?

                ORDER BY u.roll_no ASC
            `;


            db.query(
                sql,
                [
                    attendance_session_id
                ],
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
                        attendance: results
                    });

                }
            );

        }
    );

};