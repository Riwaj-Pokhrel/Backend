
const express = require("express");

const router = express.Router();


const {
    verifyToken,
    allowAdminAccess
} = require("../middleware/authMiddleware");


const subjectController =
    require("../controllers/subjectController");



// Create Subject
// SUPER_ADMIN / Department Admin


router.post(
    "/",
    verifyToken,
    allowAdminAccess,
    subjectController.createSubject
);



// View All Subjects
// SUPER_ADMIN / Department Admin


router.get(
    "/",
    verifyToken,
    allowAdminAccess,
    subjectController.getAllSubjects
);



// View Subjects By Class
// SUPER_ADMIN / Department Admin


router.get(
    "/class/:class_id",
    verifyToken,
    allowAdminAccess,
    subjectController.getSubjectsByClass
);



// View Archived Subjects
// SUPER_ADMIN / Department Admin


router.get(
    "/archived",
    verifyToken,
    allowAdminAccess,
    subjectController.getArchivedSubjects
);



// Update Subject
// SUPER_ADMIN / Department Admin


router.put(
    "/:id",
    verifyToken,
    allowAdminAccess,
    subjectController.updateSubject
);



// Archive / Activate Subject
// SUPER_ADMIN / Department Admin


router.patch(
    "/:id/archive",
    verifyToken,
    allowAdminAccess,
    subjectController.toggleArchiveSubject
);


module.exports = router;

