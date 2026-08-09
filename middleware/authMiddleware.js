const jwt = require("jsonwebtoken");
const db = require("../config/db");



// Verify JWT Token

exports.verifyToken = (req, res, next) => {

    try {

        const authHeader = req.headers.authorization;

        // Check Authorization header
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Authentication token required."
            });
        }


        // Extract token
        const token = authHeader.split(" ")[1];


        // Verify token
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );


        // Store decoded user information
        // inside request object
        req.user = decoded;


        next();

    } catch (err) {

        console.error("JWT Verification Error:", err.message);

        return res.status(401).json({
            success: false,
            message: "Invalid or expired token."
        });

    }

};



// Allow Specific Roles

exports.allowRoles = (...roles) => {

    return (req, res, next) => {

        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required."
            });
        }


        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: "Access denied."
            });
        }


        next();

    };

};



// Department Admin Check

exports.requireDepartmentAdmin = (req, res, next) => {

    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: "Authentication required."
        });
    }


    if (req.user.role !== "TEACHER") {
        return res.status(403).json({
            success: false,
            message: "Department Admin access required."
        });
    }


    if (Number(req.user.is_department_admin) !== 1) {
        return res.status(403).json({
            success: false,
            message: "Department Admin access required."
        });
    }


    next();

};


// Allow Super Admin or Department Admin (teacher with admin flag)
exports.allowAdminAccess = (req, res, next) => {

    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: "Authentication required."
        });
    }

    if (req.user.role === "SUPER_ADMIN") {
        return next();
    }

    if (req.user.role === "TEACHER" && Number(req.user.is_department_admin) === 1) {
        return next();
    }

    return res.status(403).json({
        success: false,
        message: "Access denied."
    });

};


// Check that the class belongs to a department the requesting teacher administers
exports.checkClassDepartmentAccess = (req, res, next) => {

    if (!req.user) {
        return res.status(401).json({ success: false, message: "Authentication required." });
    }

    // Super admin allowed
    if (req.user.role === "SUPER_ADMIN") {
        return next();
    }

    const classId = req.params.class_id || req.params.id || req.body.class_id;

    if (!classId) {
        return res.status(400).json({ success: false, message: "Class id is required." });
    }

    // Find department of the class
    db.query(
        "SELECT department_id FROM classes WHERE id = ?",
        [classId],
        (err, results) => {
            if (err) {
                return res.status(500).json({ success: false, message: "Database Error" });
            }

            if (results.length === 0) {
                return res.status(404).json({ success: false, message: "Class not found." });
            }

            const departmentId = results[0].department_id;

            // Verify teacher is assigned as admin for this department
            db.query(
                `SELECT id FROM department_management WHERE teacher_id = ? AND department_id = ? LIMIT 1`,
                [req.user.id, departmentId],
                (err, dmResults) => {
                    if (err) {
                        return res.status(500).json({ success: false, message: "Database Error" });
                    }

                    if (dmResults.length === 0) {
                        return res.status(403).json({ success: false, message: "Access denied." });
                    }

                    return next();

                }
            );

        }
    );

};


// Check that the student belongs to a department the requesting teacher administers
exports.checkStudentDepartmentAccess = (req, res, next) => {

    if (!req.user) {
        return res.status(401).json({ success: false, message: "Authentication required." });
    }

    if (req.user.role === "SUPER_ADMIN") {
        return next();
    }

    const studentId = req.params.id || req.body.id;

    if (!studentId) {
        return res.status(400).json({ success: false, message: "Student id is required." });
    }

    // Find class of the student
    db.query(
        `SELECT c.department_id FROM student_classes sc JOIN classes c ON sc.class_id = c.id WHERE sc.student_id = ? LIMIT 1`,
        [studentId],
        (err, results) => {
            if (err) {
                return res.status(500).json({ success: false, message: "Database Error" });
            }

            if (results.length === 0) {
                return res.status(404).json({ success: false, message: "Student or class not found." });
            }

            const departmentId = results[0].department_id;

            db.query(
                `SELECT id FROM department_management WHERE teacher_id = ? AND department_id = ? LIMIT 1`,
                [req.user.id, departmentId],
                (err, dmResults) => {
                    if (err) {
                        return res.status(500).json({ success: false, message: "Database Error" });
                    }

                    if (dmResults.length === 0) {
                        return res.status(403).json({ success: false, message: "Access denied." });
                    }

                    return next();

                }
            );

        }
    );

};