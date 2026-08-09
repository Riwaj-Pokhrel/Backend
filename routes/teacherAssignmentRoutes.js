const express = require("express");

const router = express.Router();

const {
    verifyToken,
    allowRoles
} = require("../middleware/authMiddleware");

const teacherAssignmentController =
    require("../controllers/teacherAssignmentController");



// Create Assignment
// SUPER_ADMIN / Department Admin


router.post(
    "/",
    verifyToken,
    allowRoles("SUPER_ADMIN", "TEACHER"),
    teacherAssignmentController.assignTeacher
);



// View All Assignments
// SUPER_ADMIN / Department Admin / Teacher
//
// Controller decides what each user can see.


router.get(
    "/",
    verifyToken,
    allowRoles("SUPER_ADMIN", "TEACHER"),
    teacherAssignmentController.getAllAssignments
);



// View Assignments By Teacher
// SUPER_ADMIN / Department Admin / Teacher
//
// Normal teacher can only request their own ID.


router.get(
    "/teacher/:teacher_id",
    verifyToken,
    allowRoles("SUPER_ADMIN", "TEACHER"),
    teacherAssignmentController.getAssignmentsByTeacher
);



// View Assignments By Class
// SUPER_ADMIN / Department Admin / Teacher
//
// Normal teacher sees only their assignments
// for that class.


router.get(
    "/class/:class_id",
    verifyToken,
    allowRoles("SUPER_ADMIN", "TEACHER"),
    teacherAssignmentController.getAssignmentsByClass
);



// Update Assignment
// SUPER_ADMIN / Department Admin



router.put(
    "/:id",
    verifyToken,
    allowRoles("SUPER_ADMIN", "TEACHER"),
    teacherAssignmentController.updateAssignment
);



// Activate / Deactivate Assignment
// SUPER_ADMIN / Department Admin


router.patch(
    "/:id/status",
    verifyToken,
    allowRoles("SUPER_ADMIN", "TEACHER"),
    teacherAssignmentController.toggleAssignmentStatus
);


module.exports = router;