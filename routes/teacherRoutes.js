const express = require("express");

const router = express.Router();

const {
    createTeacher,
    getAllTeachers,
    updateTeacher,
    toggleTeacherStatus
} = require("../controllers/teacherController");

router.post("/", createTeacher);

router.get("/", getAllTeachers);

router.put("/:id", updateTeacher);

router.patch("/:id/status", toggleTeacherStatus);

module.exports = router;