const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");

const app = express();
app.use(cors());
app.use(express.json());

// ================= MongoDB =================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Error:", err));

// ================= SCHEMAS =================
const userSchema = new mongoose.Schema({
  name: String,
  phone: String,
  email: { type: String, unique: true },
  password: String,
});
const User = mongoose.model("User", userSchema);

const kolamSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  nama: String,
  komoditas: String,
  totalBenih: Number,
  tglTebar: String,
  luasKolam: Number,
  feeder: { type: Number, default: 1 },
  infoKeluaran: { type: Number, default: 0 },
});
const Kolam = mongoose.model("Kolam", kolamSchema);

// ================= ROUTES =================

// === Register ===
app.post("/register", async (req, res) => {
  try {
    const { name, phone, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.json({ success: false, message: "Email sudah digunakan" });

    const hashed = await bcrypt.hash(password, 10);
    const newUser = await User.create({ name, phone, email, password: hashed });
    res.json({ success: true, message: "Registrasi berhasil", user: newUser });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});

// === Login ===
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.json({ success: false, message: "Email tidak terdaftar" });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.json({ success: false, message: "Password salah" });
    res.json({ success: true, user });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});

// === Kolam ===
app.post("/kolam", async (req, res) => {
  try {
    const kolam = await Kolam.create(req.body);
    res.json({ success: true, kolam });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});

app.get("/kolam/:userId", async (req, res) => {
  try {
    const kolam = await Kolam.find({ userId: req.params.userId });
    res.json({ success: true, kolam });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});

// Export app ke Vercel
module.exports = app;
