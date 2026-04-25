const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// in-memory data
let courses = [
  {
    code: "WEB-220",
    title: "Web Development I",
    instructor: "Prof. Patel",
    schedule: "TR 13:00-14:15",
    credits: 3,
    capacity: 24,
    students: []
  },
  {
    code: "DBA-220",
    title: "Database Fundamentals",
    instructor: "Prof. Rivera",
    schedule: "TR 09:30-11:20",
    credits: 3,
    capacity: 24,
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
  const newCourse = req.body;

  newCourse.students = [];
  courses.push(newCourse);

  res.json({ message: "Course added successfully", courses });
});

// update a course
app.put("/courses/:code", (req, res) => {
  const { code } = req.params;
  const updatedData = req.body;

  const course = courses.find(c => c.code === code);

  if (!course) {
    return res.status(404).json({ message: "Course not found" });
  }

  course.title = updatedData.title ?? course.title;
  course.instructor = updatedData.instructor ?? course.instructor;
  course.schedule = updatedData.schedule ?? course.schedule;
  course.credits = updatedData.credits ?? course.credits;
  course.capacity = updatedData.capacity ?? course.capacity;

  res.json({ message: "Course updated successfully", course });
});

// enroll a student in a course
app.post("/enroll", (req, res) => {
  const { studentId, courseCode } = req.body;

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
  const { studentId, courseCode } = req.body;

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
app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});