const express = require("express");

const router = express.Router();

const {
    verifyToken,
    allowRoles
} = require("../middleware/authMiddleware");

const {
    createDepartment,
    getAllDepartments,
    updateDepartment,
    deleteDepartment,
    makeDepartmentAdmin,
    removeDepartmentAdmin,
    assignDepartment,
    getDepartmentAssignments
} = require("../controllers/departmentController");



// Department Management
// SUPER_ADMIN ONLY



// Create Department
router.post(
    "/",
    verifyToken,
    allowRoles("SUPER_ADMIN"),
    createDepartment
);


// View Departments
router.get(
    "/",
    verifyToken,
    allowRoles("SUPER_ADMIN"),
    getAllDepartments
);


// Update Department
router.put(
    "/:id",
    verifyToken,
    allowRoles("SUPER_ADMIN"),
    updateDepartment
);


// Delete Department
router.delete(
    "/:id",
    verifyToken,
    allowRoles("SUPER_ADMIN"),
    deleteDepartment
);



// Department Admin Management
// SUPER_ADMIN ONLY



// Give Department Admin privilege
router.patch(
    "/admin/:teacher_id",
    verifyToken,
    allowRoles("SUPER_ADMIN"),
    makeDepartmentAdmin
);


// Remove Department Admin privilege
router.patch(
    "/admin/remove/:teacher_id",
    verifyToken,
    allowRoles("SUPER_ADMIN"),
    removeDepartmentAdmin
);



// Department Assignment
// SUPER_ADMIN ONLY



// Assign department to teacher
router.post(
    "/assign",
    verifyToken,
    allowRoles("SUPER_ADMIN"),
    assignDepartment
);


// View department assignments
router.get(
    "/assignments",
    verifyToken,
    allowRoles("SUPER_ADMIN"),
    getDepartmentAssignments
);


module.exports = router;