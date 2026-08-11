const express = require("express");

const router = express.Router();

const {
    verifyToken,
    allowAdminAccess,
    checkClassDepartmentAccess,
    checkStudentDepartmentAccess
} = require("../middleware/authMiddleware");

const {
    createStudent,
    getAllStudents,
    getStudentsByClass,
    updateStudent,
    toggleStudentStatus,
    resetStudentPassword,
    searchStudent
} = require("../controllers/studentController");



// Create Student
// Super Admin / Department Admin

router.post(
    "/",
    verifyToken,
    allowAdminAccess,
    createStudent
);



// View All Students
// Super Admin / Department Admin

router.get(
    "/",
    verifyToken,
    allowAdminAccess,
    getAllStudents
);



// View Students of a Class
// Super Admin / Department Admin
// of that class's department

router.get(
    "/class/:class_id",
    verifyToken,
    allowAdminAccess,
    checkClassDepartmentAccess,
    getStudentsByClass
);



// Update Student
// Super Admin / Department Admin
// of student's department

router.put(
    "/:id",
    verifyToken,
    allowAdminAccess,
    checkStudentDepartmentAccess,
    updateStudent
);



// Activate / Deactivate Student

router.patch(
    "/:id/status",
    verifyToken,
    allowAdminAccess,
    checkStudentDepartmentAccess,
    toggleStudentStatus
);



// Reset Student Password
// Super Admin / Department Admin
// of student's department

router.patch(
    "/:id/reset-password",
    verifyToken,
    allowAdminAccess,
    checkStudentDepartmentAccess,
    resetStudentPassword
);



// Search Student

router.get(
    "/search/:roll_no",
    verifyToken,
    allowAdminAccess,
    searchStudent
);


module.exports = router;