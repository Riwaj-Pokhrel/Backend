const express = require("express");

const router = express.Router();

const {
    verifyToken,
    allowRoles
} = require("../middleware/authMiddleware");

const attendanceController =
    require("../controllers/attendanceController");



// Start today's attendance session


router.post(
    "/start",
    verifyToken,
    allowRoles("SUPER_ADMIN", "TEACHER"),
    attendanceController.startAttendance
);



// Get today's attendance sessions


router.get(
    "/teacher/:teacher_id/today",
    verifyToken,
    allowRoles("SUPER_ADMIN", "TEACHER"),
    attendanceController.getTodaySessions
);



// Get students for attendance session


router.get(
    "/session/:attendance_session_id/students",
    verifyToken,
    allowRoles("SUPER_ADMIN", "TEACHER"),
    attendanceController.getStudentsForAttendance
);



// Mark attendance


router.post(
    "/mark",
    verifyToken,
    allowRoles("SUPER_ADMIN", "TEACHER"),
    attendanceController.markAttendance
);



// Edit today's attendance


router.put(
    "/:attendance_id",
    verifyToken,
    allowRoles("SUPER_ADMIN", "TEACHER"),
    attendanceController.updateAttendance
);



// View attendance records for a session


router.get(
    "/session/:attendance_session_id",
    verifyToken,
    allowRoles("SUPER_ADMIN", "TEACHER"),
    attendanceController.getSessionAttendance
);


module.exports = router;