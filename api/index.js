const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const http = require("http");
const { Server } = require("socket.io");

// Import MQTT client instance
const mqttClient = require("./mqttClient");

const app = express();
app.use(cors());
app.use(express.json());

/* ================= MONGODB ================= */
mongoose.connect("mongodb+srv://Naufal26:707369123.@cluster0.lnmslos.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Error:", err));

/* ================= SCHEMAS ================= */
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

// === Schedule Schema ===
const scheduleSchema = new mongoose.Schema({
  source: { type: String, required: true }, // bisa esp32_xxx, MQTT, atau userId
  hour: Number,
  minute: Number,
  portion: Number,
  action: String,
  createdAt: { type: Date, default: Date.now }
});
const Schedule = mongoose.model("Schedule", scheduleSchema);

// === Control Schema ===
const controlSchema = new mongoose.Schema({
  source: { type: String, required: true }, // bisa esp32_xxx, MQTT, atau userId
  action: String,
  portion: Number,
  createdAt: { type: Date, default: Date.now }
});
const Control = mongoose.model("Control", controlSchema);

/* ================= AUTH ROUTES ================= */
app.post("/register", async (req, res) => {
  try {
    const { name, phone, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.json({ success: false, message: "Email sudah digunakan" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, phone, email, password: hashedPassword });
    await newUser.save();

    res.json({
      success: true,
      message: "Registrasi berhasil",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
      },
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ success: false, message: "Email tidak terdaftar" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.json({ success: false, message: "Password salah" });
    }

    res.json({
      success: true,
      message: "Login berhasil",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

app.post("/update-profile", async (req, res) => {
  try {
    const { userId, name, phone } = req.body;

    if (!userId || !name || !phone) {
      return res.json({ success: false, message: "Data tidak lengkap" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { name, phone },
      { new: true }
    );

    if (!updatedUser) {
      return res.json({ success: false, message: "User tidak ditemukan" });
    }

    res.json({
      success: true,
      message: "Profil berhasil diperbarui",
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
      },
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});


app.post("/change-password", async (req, res) => {
  try {
    const { userId, oldPassword, newPassword } = req.body;

    if (!userId || !oldPassword || !newPassword) {
      return res.json({ success: false, message: "Data tidak lengkap" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.json({ success: false, message: "User tidak ditemukan" });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.json({ success: false, message: "Password lama salah" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.json({ success: true, message: "Password berhasil diubah" });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});


// === InfoFeeder Schema ===
const infoFeederSchema = new mongoose.Schema({
  kolamId: { type: mongoose.Schema.Types.ObjectId, ref: "Kolam", required: true },
  jenisPakan: { type: String, default: "" },
  ukuranPakan: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now }
});
const InfoFeeder = mongoose.model("InfoFeeder", infoFeederSchema);
 
/* ================= KOLAM ROUTES ================= */
app.post("/kolam", async (req, res) => {
  try {
    const { userId, nama, komoditas, totalBenih, tglTebar, luasKolam } = req.body;
    if (!userId) {
      return res.json({ success: false, message: "User ID tidak ditemukan" });
    }

    const kolamBaru = new Kolam({
      userId,
      nama,
      komoditas,
      totalBenih,
      tglTebar,
      luasKolam,
      feeder: 1,
    });

    // Simpan kolam dulu agar punya _id
    await kolamBaru.save();

    // === Tambahkan InfoFeeder otomatis setelah kolam berhasil dibuat ===
    const infoFeederBaru = new InfoFeeder({
      kolamId: kolamBaru._id,
      jenisPakan: "",
      ukuranPakan: "",
    });
    await infoFeederBaru.save();

    res.json({
      success: true,
      message: "Kolam & Info Feeder berhasil ditambahkan",
      kolam: kolamBaru,
      infoFeeder: infoFeederBaru
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});


app.get("/kolam/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const kolamList = await Kolam.find({ userId });
    res.json({ success: true, kolam: kolamList });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

/* ================= INFO FEEDER ================= */
app.get("/info-feeder/:kolamId", async (req, res) => {
  try {
    const { kolamId } = req.params;
    const info = await InfoFeeder.findOne({ kolamId });
    if (!info) {
      return res.json({ success: false, message: "Info feeder tidak ditemukan" });
    }
    res.json({ success: true, info });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

// === UPDATE INFO FEEDER ===
app.put("/info-feeder/update/:kolamId", async (req, res) => {
  try {
    const { kolamId } = req.params;
    const { jenisPakan, ukuranPakan } = req.body;

    const info = await InfoFeeder.findOneAndUpdate(
      { kolamId },
      { jenisPakan, ukuranPakan },
      { new: true }
    );

    if (!info) {
      return res.json({ success: false, message: "Info feeder tidak ditemukan" });
    }

    res.json({ success: true, message: "Info feeder diperbarui", info });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

/* ================= UPDATE KOLAM ================= */
app.put("/kolam/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body; // bisa berisi infoKeluaran, nama, dll

    const kolam = await Kolam.findByIdAndUpdate(id, updateData, { new: true });

    if (!kolam) {
      return res.json({ success: false, message: "Kolam tidak ditemukan" });
    }

    res.json({ success: true, message: "Kolam berhasil diperbarui", kolam });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

/* ================= UPDATE INFO KOLAM ================= */
app.put("/kolam/update-info/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { komoditas, totalBenih } = req.body;

    if (!totalBenih || !komoditas) {
      return res.json({ success: false, message: "totalBenih dan komoditas wajib diisi" });
    }

    const kolam = await Kolam.findByIdAndUpdate(
      id,
      { totalBenih, komoditas },
      { new: true }
    );

    if (!kolam) {
      return res.json({ success: false, message: "Kolam tidak ditemukan" });
    }

    res.json({
      success: true,
      message: "Info kolam berhasil diperbarui",
      kolam
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});


/* ================= HAPUS KOLAM ================= */
app.delete("/kolam/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Hapus semua schedule terkait kolam ini juga (biar rapi)
    await Schedule.deleteMany({ kolamId: id });

    const kolam = await Kolam.findByIdAndDelete(id);

    if (!kolam) {
      return res.json({ success: false, message: "Kolam tidak ditemukan" });
    }

    res.json({ success: true, message: "Kolam berhasil dihapus" });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

app.get("/schedule/:source", async (req, res) => {
  try {
    const { source } = req.params;
    const schedules = await Schedule.find({ source });
    res.json({ success: true, schedules });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

app.get("/control/:source", async (req, res) => {
  try {
    const { source } = req.params;
    const controls = await Control.find({ source });
    res.json({ success: true, controls });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});


/* ================= SOCKET.IO SETUP ================= */
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  console.log("✅ Client connected via Socket.io");

  socket.on("playFeeder", (data) => {
    console.log("▶️ Play command:", data);
    mqttClient.publish("feeder/control", JSON.stringify(data));
  });

  socket.on("addSchedule", (data) => {
    console.log("🕒 Add schedule:", data);
    mqttClient.publish("feeder/schedule", JSON.stringify(data));
  });

  socket.on("deleteSchedule", (data) => {
    console.log("❌ Delete schedule:", data);
    mqttClient.publish("feeder/schedule", JSON.stringify({
      action: "REMOVE",
      hour: data.hour,
      minute: data.minute,
      portion: data.portion,
      source: "App",
    }));
  });
});

mqttClient.on("message", async (topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    console.log(`📩 MQTT [${topic}]`, data);

    if (topic === "feeder/info") {
      io.emit("feederInfo", data);
    }

    if (topic === "feeder/control") {
      io.emit("feederControl", data);

      const control = new Control({
        source: data.source,   // langsung pakai source sebagai kunci
        action: data.action,
        portion: data.portion
      });
      await control.save();
    }

    if (topic === "feeder/schedule") {
      io.emit("feederSchedule", data);

      if (data.action === "ADD") {
        const schedule = new Schedule({
          source: data.source,  // langsung pakai source
          hour: data.hour,
          minute: data.minute,
          portion: data.portion,
          action: data.action
        });
        await schedule.save();
      } else if (data.action === "REMOVE") {
        await Schedule.deleteOne({
          source: data.source,
          hour: data.hour,
          minute: data.minute,
          portion: data.portion
        });
      }
    }
  } catch (err) {
    console.error("❌ Error parsing MQTT:", err);
  }
});




const PORT = 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://192.168.1.17:${PORT}`);
});
