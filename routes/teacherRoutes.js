const express = require("express");

const router = express.Router();

const {
    verifyToken,
    allowRoles,
    allowAdminAccess
} = require("../middleware/authMiddleware");

const {
    createTeacher,
    getAllTeachers,
    updateTeacher,
    toggleTeacherStatus,
    resetTeacherPassword
} = require("../controllers/teacherController");



// Create Teacher
// SUPER_ADMIN / Department Admin

router.post(
    "/",
    verifyToken,
    allowAdminAccess,
    createTeacher
);



// View All Teachers
// SUPER_ADMIN / Department Admin
//
// A Department Admin needs to browse teachers in order to assign
// them to subjects in their department — account management
// (create/edit/deactivate/reset password) stays SUPER_ADMIN only.

router.get(
    "/",
    verifyToken,
    allowAdminAccess,
    getAllTeachers
);



// Update Teacher
// SUPER_ADMIN ONLY

router.put(
    "/:id",
    verifyToken,
    allowRoles("SUPER_ADMIN"),
    updateTeacher
);



// Activate / Deactivate Teacher
// SUPER_ADMIN ONLY

router.patch(
    "/:id/status",
    verifyToken,
    allowRoles("SUPER_ADMIN"),
    toggleTeacherStatus
);



// Reset Teacher Password
// SUPER_ADMIN ONLY

router.patch(
    "/:id/reset-password",
    verifyToken,
    allowRoles("SUPER_ADMIN"),
    resetTeacherPassword
);


module.exports = router;