const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const databasePath = path.join(__dirname, "database.sqlite");
const db = new sqlite3.Database(databasePath);

const seededUsers = [
  {
    id: "student-1001",
    username: "student1",
    name: "Student One",
    role: "student",
    passwordHash: "$2b$10$8eU3gWYn.2J1CME2SStdCeV204KOL4pRPEG.KZ2cXLW34P6QfI9GS"
  },
  {
    id: "teacher-2001",
    username: "teacher1",
    name: "Teacher One",
    role: "teacher",
    passwordHash: "$2b$10$revbJsHVbdnhb.LYdZvATerjr59jfZjoT.wOmAHnYv0ppf7jvFSh."
  }
];

const seededCourses = [
  {
    code: "WEB-220",
    title: "Web Development I",
    instructor: "Prof. Patel",
    schedule: "TR 13:00-14:15",
    credits: 3,
    capacity: 24,
    description: "Introductory web development course covering HTML, CSS, and JavaScript."
  },
  {
    code: "DBA-220",
    title: "Database Fundamentals",
    instructor: "Prof. Rivera",
    schedule: "TR 09:30-11:20",
    credits: 3,
    capacity: 24,
    description: "Relational database concepts, modeling, and introductory SQL."
  }
];

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }

      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row ?? null);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows ?? []);
    });
  });
}

async function getStudentEnrolledCourses(userId) {
  const enrollmentRows = await all(
    `SELECT course_code
     FROM enrollments
     WHERE user_id = ?
     ORDER BY course_code`,
    [userId]
  );

  return enrollmentRows.map(row => row.course_code);
}

async function getCourseStudents(courseCode) {
  const studentRows = await all(
    `SELECT user_id
     FROM enrollments
     WHERE course_code = ?
     ORDER BY user_id`,
    [courseCode]
  );

  return studentRows.map(row => row.user_id);
}

async function hydrateUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    username: row.username,
    name: row.name,
    role: row.role,
    passwordHash: row.passwordHash,
    enrolledCourses: row.role === "student" ? await getStudentEnrolledCourses(row.id) : []
  };
}

async function hydrateCourse(row) {
  if (!row) {
    return null;
  }

  return {
    code: row.code,
    title: row.title,
    instructor: row.instructor,
    schedule: row.schedule,
    description: row.description,
    credits: row.credits,
    capacity: row.capacity,
    students: await getCourseStudents(row.code)
  };
}

async function initializeDatabase() {
  await run("PRAGMA foreign_keys = ON");

  await run(
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('student', 'teacher')),
      password_hash TEXT NOT NULL
    )`
  );

  await run(
    `CREATE TABLE IF NOT EXISTS courses (
      code TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      instructor TEXT NOT NULL,
      schedule TEXT NOT NULL,
      description TEXT NOT NULL,
      credits INTEGER NOT NULL,
      capacity INTEGER NOT NULL
    )`
  );

  await run(
    `CREATE TABLE IF NOT EXISTS enrollments (
      user_id TEXT NOT NULL,
      course_code TEXT NOT NULL,
      PRIMARY KEY (user_id, course_code),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (course_code) REFERENCES courses(code) ON DELETE CASCADE
    )`
  );

  for (const user of seededUsers) {
    await run(
      `INSERT OR IGNORE INTO users (id, username, name, role, password_hash)
       VALUES (?, ?, ?, ?, ?)`,
      [user.id, user.username, user.name, user.role, user.passwordHash]
    );
  }

  for (const course of seededCourses) {
    await run(
      `INSERT OR IGNORE INTO courses (code, title, instructor, schedule, description, credits, capacity)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        course.code,
        course.title,
        course.instructor,
        course.schedule,
        course.description,
        course.credits,
        course.capacity
      ]
    );
  }
}

async function getUserById(userId) {
  const row = await get(
    `SELECT id, username, name, role, password_hash AS passwordHash
     FROM users
     WHERE id = ?`,
    [userId]
  );

  return hydrateUser(row);
}

async function getUserByUsername(username) {
  const row = await get(
    `SELECT id, username, name, role, password_hash AS passwordHash
     FROM users
     WHERE lower(username) = lower(?)`,
    [username]
  );

  return hydrateUser(row);
}

async function getAllCourses() {
  const courseRows = await all(
    `SELECT code, title, instructor, schedule, description, credits, capacity
     FROM courses
     ORDER BY code`
  );

  return Promise.all(courseRows.map(row => hydrateCourse(row)));
}

async function getCourseByCode(code) {
  const row = await get(
    `SELECT code, title, instructor, schedule, description, credits, capacity
     FROM courses
     WHERE code = ?`,
    [code]
  );

  return hydrateCourse(row);
}

async function createCourse(course) {
  await run(
    `INSERT INTO courses (code, title, instructor, schedule, description, credits, capacity)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      course.code,
      course.title,
      course.instructor,
      course.schedule,
      course.description,
      course.credits,
      course.capacity
    ]
  );

  return getCourseByCode(course.code);
}

async function updateCourse(code, course) {
  await run(
    `UPDATE courses
     SET title = ?, instructor = ?, schedule = ?, description = ?, credits = ?, capacity = ?
     WHERE code = ?`,
    [course.title, course.instructor, course.schedule, course.description, course.credits, course.capacity, code]
  );

  return getCourseByCode(code);
}

async function enrollStudent(userId, courseCode) {
  await run(
    `INSERT INTO enrollments (user_id, course_code)
     VALUES (?, ?)`,
    [userId, courseCode]
  );
}

async function dropStudent(userId, courseCode) {
  await run(
    `DELETE FROM enrollments
     WHERE user_id = ? AND course_code = ?`,
    [userId, courseCode]
  );
}

async function deleteCourse(code) {
  await run(
    `DELETE FROM courses
     WHERE code = ?`,
    [code]
  );
}

module.exports = {
  databasePath,
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
};