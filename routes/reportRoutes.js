const express = require("express");

const router = express.Router();

const {
    verifyToken,
    allowRoles
} = require("../middleware/authMiddleware");

const reportController = require("../controllers/reportController");



// Student Attendance Summary
// Student can view own report.
// Teachers/Admins can view according to permissions.


router.get(
    "/student/:student_id",
    verifyToken,
    allowRoles("SUPER_ADMIN", "TEACHER", "STUDENT"),
    reportController.getStudentAttendanceSummary
);



// Class Attendance Report
// SUPER_ADMIN / Department Admin / Teacher


router.get(
    "/class/:class_id",
    verifyToken,
    allowRoles("SUPER_ADMIN", "TEACHER"),
    reportController.getClassAttendanceReport
);



// Subject Attendance Report
// SUPER_ADMIN / Department Admin / Teacher


router.get(
    "/subject/:subject_id/class/:class_id",
    verifyToken,
    allowRoles("SUPER_ADMIN", "TEACHER"),
    reportController.getSubjectAttendanceReport
);



// Teacher Report


router.get(
    "/teacher/:teacher_id",
    verifyToken,
    allowRoles("SUPER_ADMIN", "TEACHER"),
    reportController.getTeacherReport
);


module.exports = router;