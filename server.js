const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5000;

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNumber(value) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function buildCoursePayload(payload, existingCourse = {}) {
  const course = {
    code: normalizeText(payload.code ?? existingCourse.code),
    title: normalizeText(payload.title ?? existingCourse.title),
    instructor: normalizeText(payload.instructor ?? existingCourse.instructor),
    schedule: normalizeText(payload.schedule ?? existingCourse.schedule),
    description: normalizeText(payload.description ?? existingCourse.description),
    credits: normalizeNumber(payload.credits ?? existingCourse.credits),
    capacity: normalizeNumber(payload.capacity ?? existingCourse.capacity),
    students: Array.isArray(existingCourse.students) ? existingCourse.students : []
  };

  return course;
}

function validateCourse(course, { requireCode = true } = {}) {
  if (requireCode && !course.code) {
    return "Course code is required";
  }

  if (!course.title) {
    return "Course title is required";
  }

  if (!course.instructor) {
    return "Instructor is required";
  }

  if (!course.schedule) {
    return "Schedule is required";
  }

  if (!Number.isInteger(course.credits) || course.credits <= 0) {
    return "Credits must be a positive whole number";
  }

  if (!Number.isInteger(course.capacity) || course.capacity <= 0) {
    return "Capacity must be a positive whole number";
  }

  return null;
}

// in-memory data
let courses = [
  {
    code: "WEB-220",
    title: "Web Development I",
    instructor: "Prof. Patel",
    schedule: "TR 13:00-14:15",
    credits: 3,
    capacity: 24,
    description: "Introductory web development course covering HTML, CSS, and JavaScript.",
    students: []
  },
  {
    code: "DBA-220",
    title: "Database Fundamentals",
    instructor: "Prof. Rivera",
    schedule: "TR 09:30-11:20",
    credits: 3,
    capacity: 24,
    description: "Relational database concepts, modeling, and introductory SQL.",
    students: []
  }
];

// test route
app.get("/", (req, res) => {
  res.send("Backend is working");
});

// get all courses
app.get("/courses", (req, res) => {
  res.json(courses);
});

// add a new course
app.post("/courses", (req, res) => {
  const newCourse = buildCoursePayload(req.body);
  const validationError = validateCourse(newCourse);

  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  const duplicateCourse = courses.find(course => course.code === newCourse.code);

  if (duplicateCourse) {
    return res.status(400).json({ message: "Course code already exists" });
  }

  courses.push(newCourse);

  res.status(201).json({ message: "Course added successfully", course: newCourse, courses });
});

// update a course
app.put("/courses/:code", (req, res) => {
  const { code } = req.params;
  const course = courses.find(c => c.code === code);

  if (!course) {
    return res.status(404).json({ message: "Course not found" });
  }

  const updatedCourse = buildCoursePayload(req.body, course);
  const validationError = validateCourse(updatedCourse, { requireCode: false });

  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  if (updatedCourse.capacity < course.students.length) {
    return res.status(400).json({ message: "Capacity cannot be less than enrolled students" });
  }

  course.title = updatedCourse.title;
  course.instructor = updatedCourse.instructor;
  course.schedule = updatedCourse.schedule;
  course.credits = updatedCourse.credits;
  course.capacity = updatedCourse.capacity;
  course.description = updatedCourse.description;

  res.json({ message: "Course updated successfully", course });
});

// enroll a student in a course
app.post("/enroll", (req, res) => {
  const studentId = normalizeText(req.body.studentId);
  const courseCode = normalizeText(req.body.courseCode);

  if (!studentId || !courseCode) {
    return res.status(400).json({ message: "Student ID and course code are required" });
  }

  const course = courses.find(c => c.code === courseCode);

  if (!course) {
    return res.status(404).json({ message: "Course not found" });
  }

  if (course.students.includes(studentId)) {
    return res.status(400).json({ message: "Student already enrolled" });
  }

  if (course.students.length >= course.capacity) {
    return res.status(400).json({ message: "Course is full" });
  }

  course.students.push(studentId);

  res.json({ message: "Student enrolled successfully", course });
});

// drop a student from a course
app.post("/drop", (req, res) => {
  const studentId = normalizeText(req.body.studentId);
  const courseCode = normalizeText(req.body.courseCode);

  if (!studentId || !courseCode) {
    return res.status(400).json({ message: "Student ID and course code are required" });
  }

  const course = courses.find(c => c.code === courseCode);

  if (!course) {
    return res.status(404).json({ message: "Course not found" });
  }

  if (!course.students.includes(studentId)) {
    return res.status(400).json({ message: "Student is not enrolled in this course" });
  }

  course.students = course.students.filter(id => id !== studentId);

  res.json({ message: "Course dropped successfully", course });
});

// delete a course
app.delete("/courses/:code", (req, res) => {
  const { code } = req.params;

  const courseExists = courses.find(c => c.code === code);

  if (!courseExists) {
    return res.status(404).json({ message: "Course not found" });
  }

  courses = courses.filter(c => c.code !== code);

  res.json({ message: "Course deleted successfully", courses });
});

// start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});