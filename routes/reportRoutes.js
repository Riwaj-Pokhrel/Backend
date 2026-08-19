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



// Student Attendance Summary — CSV Download


router.get(
    "/student/:student_id/download",
    verifyToken,
    allowRoles("SUPER_ADMIN", "TEACHER", "STUDENT"),
    reportController.getStudentAttendanceSummaryCSV
);



// Class Attendance Report
// SUPER_ADMIN / Department Admin / Teacher


router.get(
    "/class/:class_id",
    verifyToken,
    allowRoles("SUPER_ADMIN", "TEACHER"),
    reportController.getClassAttendanceReport
);



// Class Attendance Report — CSV Download


router.get(
    "/class/:class_id/download",
    verifyToken,
    allowRoles("SUPER_ADMIN", "TEACHER"),
    reportController.getClassAttendanceReportCSV
);



// Attendance Session Log — when attendance was taken
// SUPER_ADMIN / Department Admin / Teacher (own sessions only)


router.get(
    "/sessions",
    verifyToken,
    allowRoles("SUPER_ADMIN", "TEACHER"),
    reportController.getSessionLog
);



// Sessions Taken Per Teacher
// SUPER_ADMIN / Department Admin


router.get(
    "/sessions-by-teacher",
    verifyToken,
    allowRoles("SUPER_ADMIN", "TEACHER"),
    reportController.getTeacherSessionCounts
);



// Student Attendance Report — Per Subject
// Student can view own report.
// Teachers/Admins can view according to permissions.


router.get(
    "/student/:student_id/subjects",
    verifyToken,
    allowRoles("SUPER_ADMIN", "TEACHER", "STUDENT"),
    reportController.getStudentSubjectReport
);



// Student Full Session Log — every session, every active subject
// Student can view own log.
// Teachers/Admins can view according to permissions.


router.get(
    "/student/:student_id/sessions",
    verifyToken,
    allowRoles("SUPER_ADMIN", "TEACHER", "STUDENT"),
    reportController.getStudentAllSessions
);



// Student Full Session Log — CSV Download


router.get(
    "/student/:student_id/sessions/download",
    verifyToken,
    allowRoles("SUPER_ADMIN", "TEACHER", "STUDENT"),
    reportController.getStudentAllSessionsCSV
);



// Subject Attendance Report
// SUPER_ADMIN / Department Admin / Teacher


router.get(
    "/subject/:subject_id/class/:class_id",
    verifyToken,
    allowRoles("SUPER_ADMIN", "TEACHER"),
    reportController.getSubjectAttendanceReport
);



// Subject Attendance Report — CSV Download


router.get(
    "/subject/:subject_id/class/:class_id/download",
    verifyToken,
    allowRoles("SUPER_ADMIN", "TEACHER"),
    reportController.getSubjectAttendanceReportCSV
);



// Student Session Detail — one subject, one student, every session
// SUPER_ADMIN / Department Admin / Teacher


router.get(
    "/subject/:subject_id/class/:class_id/student/:student_id",
    verifyToken,
    allowRoles("SUPER_ADMIN", "TEACHER"),
    reportController.getStudentSubjectSessionDetail
);



// Student Session Detail — CSV Download


router.get(
    "/subject/:subject_id/class/:class_id/student/:student_id/download",
    verifyToken,
    allowRoles("SUPER_ADMIN", "TEACHER"),
    reportController.getStudentSubjectSessionDetailCSV
);



// Teacher Report


router.get(
    "/teacher/:teacher_id",
    verifyToken,
    allowRoles("SUPER_ADMIN", "TEACHER"),
    reportController.getTeacherReport
);


module.exports = router;