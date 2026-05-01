const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const {
  initializeDatabase,
  getUserById,
  getUserByUsername,
  getAllCourses,
  getCourseByCode,
  createCourse,
  updateCourse,
  enrollStudent,
  dropStudent,
  deleteCourse
} = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT) || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "development-only-secret-change-me";
const TOKEN_EXPIRATION = "8h";

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeLowerText(value) {
  return normalizeText(value).toLowerCase();
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
    students: Array.isArray(existingCourse.students) ? [...existingCourse.students] : []
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

function buildUserResponse(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
    enrolledCourses: user.role === "student" ? [...user.enrolledCourses] : undefined
  };
}

function buildCourseResponse(course, user) {
  const baseCourse = {
    code: course.code,
    title: course.title,
    instructor: course.instructor,
    schedule: course.schedule,
    description: course.description,
    credits: course.credits,
    capacity: course.capacity,
    enrolledCount: course.students.length,
    availableSeats: Math.max(course.capacity - course.students.length, 0)
  };

  if (user.role === "teacher") {
    return {
      ...baseCourse,
      students: [...course.students]
    };
  }

  return {
    ...baseCourse,
    enrolled: course.students.includes(user.id)
  };
}

const authenticateToken = asyncHandler(async (req, res, next) => {
  const authorizationHeader = req.headers.authorization || "";
  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "A valid bearer token is required" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await getUserById(payload.sub);

    if (!user) {
      return res.status(401).json({ message: "User account no longer exists" });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
});

function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "You do not have permission to perform this action" });
    }

    next();
  };
}

// public routes
app.get("/", (req, res) => {
  res.send("Backend is working");
});

app.post("/auth/login", asyncHandler(async (req, res) => {
  const username = normalizeLowerText(req.body.username);
  const password = normalizeText(req.body.password);

  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required" });
  }

  const user = await getUserByUsername(username);

  if (!user) {
    return res.status(401).json({ message: "Invalid username or password" });
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    return res.status(401).json({ message: "Invalid username or password" });
  }

  const token = jwt.sign(
    {
      role: user.role,
      username: user.username
    },
    JWT_SECRET,
    {
      expiresIn: TOKEN_EXPIRATION,
      subject: user.id
    }
  );

  return res.json({
    message: "Login successful",
    token,
    user: buildUserResponse(user)
  });
}));

// authenticated routes
app.get("/auth/me", authenticateToken, (req, res) => {
  res.json({ user: buildUserResponse(req.user) });
});

app.get("/courses", authenticateToken, asyncHandler(async (req, res) => {
  const courses = await getAllCourses();
  res.json(courses.map(course => buildCourseResponse(course, req.user)));
}));

app.post("/courses", authenticateToken, authorizeRoles("teacher"), asyncHandler(async (req, res) => {
  const newCourse = buildCoursePayload(req.body);
  const validationError = validateCourse(newCourse);

  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  const duplicateCourse = await getCourseByCode(newCourse.code);

  if (duplicateCourse) {
    return res.status(400).json({ message: "Course code already exists" });
  }

  const createdCourse = await createCourse(newCourse);
  const courses = await getAllCourses();

  return res.status(201).json({
    message: "Course added successfully",
    course: buildCourseResponse(createdCourse, req.user),
    courses: courses.map(course => buildCourseResponse(course, req.user))
  });
}));

app.put("/courses/:code", authenticateToken, authorizeRoles("teacher"), asyncHandler(async (req, res) => {
  const { code } = req.params;
  const course = await getCourseByCode(code);

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

  const storedCourse = await updateCourse(code, updatedCourse);

  return res.json({
    message: "Course updated successfully",
    course: buildCourseResponse(storedCourse, req.user)
  });
}));

app.post("/enroll", authenticateToken, authorizeRoles("student"), asyncHandler(async (req, res) => {
  const courseCode = normalizeText(req.body.courseCode);

  if (!courseCode) {
    return res.status(400).json({ message: "Course code is required" });
  }

  const course = await getCourseByCode(courseCode);

  if (!course) {
    return res.status(404).json({ message: "Course not found" });
  }

  if (course.students.includes(req.user.id)) {
    return res.status(400).json({ message: "Student already enrolled" });
  }

  if (course.students.length >= course.capacity) {
    return res.status(400).json({ message: "Course is full" });
  }

  await enrollStudent(req.user.id, course.code);
  const updatedCourse = await getCourseByCode(course.code);
  const updatedUser = await getUserById(req.user.id);

  return res.json({
    message: "Student enrolled successfully",
    course: buildCourseResponse(updatedCourse, updatedUser),
    user: buildUserResponse(updatedUser)
  });
}));

app.post("/drop", authenticateToken, authorizeRoles("student"), asyncHandler(async (req, res) => {
  const courseCode = normalizeText(req.body.courseCode);

  if (!courseCode) {
    return res.status(400).json({ message: "Course code is required" });
  }

  const course = await getCourseByCode(courseCode);

  if (!course) {
    return res.status(404).json({ message: "Course not found" });
  }

  if (!course.students.includes(req.user.id)) {
    return res.status(400).json({ message: "Student is not enrolled in this course" });
  }

  await dropStudent(req.user.id, course.code);
  const updatedCourse = await getCourseByCode(course.code);
  const updatedUser = await getUserById(req.user.id);

  return res.json({
    message: "Course dropped successfully",
    course: buildCourseResponse(updatedCourse, updatedUser),
    user: buildUserResponse(updatedUser)
  });
}));

app.delete("/courses/:code", authenticateToken, authorizeRoles("teacher"), asyncHandler(async (req, res) => {
  const { code } = req.params;
  const courseExists = await getCourseByCode(code);

  if (!courseExists) {
    return res.status(404).json({ message: "Course not found" });
  }

  await deleteCourse(code);
  const courses = await getAllCourses();

  return res.json({
    message: "Course deleted successfully",
    courses: courses.map(course => buildCourseResponse(course, req.user))
  });
}));

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ message: "Internal server error" });
});

async function startServer() {
  await initializeDatabase();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(error => {
  console.error("Failed to start server", error);
  process.exit(1);
});