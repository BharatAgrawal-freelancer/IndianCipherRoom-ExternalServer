const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const dotenv = require("dotenv");
const cors = require("cors");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 🔗 MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// ☁️ Cloudinary Config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 🧾 MongoDB Schema
const ImageSchema = new mongoose.Schema({
  imageUrl: String,
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
});


const ImageModel = mongoose.model("Image", ImageSchema);

const TextSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    unique: true,
  },
  text: {
    type: String,
    default: "",
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

const TextModel = mongoose.model("Text", TextSchema);
// 📤 Multer (Memory Storage)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { files: 10 } // max 10 images
});

// 🚀 Upload Route
app.post("/upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image uploaded" });
    }

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(
      `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`,
      {
        folder: "indian_cipher_room",
      }
    );

    // Save URL to MongoDB
    const image = new ImageModel({
      imageUrl: result.secure_url,
    });

    await image.save();

    res.status(200).json({
      message: "Image uploaded successfully",
      imageUrl: result.secure_url,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Upload failed" });
  }
});

app.post("/upload-multiple", upload.array("images", 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No images uploaded" });
    }

    const uploadPromises = req.files.map(file => {
      return cloudinary.uploader.upload(
        `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
        {
          folder: "indian_cipher_room",
        }
      );
    });

    // Upload all images parallel me
    const results = await Promise.all(uploadPromises);

    // MongoDB me save
    const imageDocs = results.map(result => ({
      imageUrl: result.secure_url
    }));

    await ImageModel.insertMany(imageDocs);

    res.status(200).json({
      message: "Images uploaded successfully",
      images: results.map(r => r.secure_url),
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Upload failed" });
  }
});

app.post("/append-text", async (req, res) => {
  try {
    const { deviceId, text } = req.body;

    if (!deviceId || !text) {
      return res.status(400).json({
        message: "deviceId and text are required",
      });
    }

    const result = await TextModel.findOneAndUpdate(
      { deviceId },
      {
        $concat: undefined,
      },
      { new: true }
    );

    const doc = await TextModel.findOne({ deviceId });

    if (doc) {
      doc.text += text;
      doc.updatedAt = new Date();
      await doc.save();

      return res.json({
        message: "Text appended successfully",
        data: doc,
      });
    }

    const newDoc = await TextModel.create({
      deviceId,
      text,
    });

    res.json({
      message: "New document created",
      data: newDoc,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});
// 📥 Get All Images
app.get("/images", async (req, res) => {
  try {
    const images = await ImageModel.find()
      .sort({ uploadedAt: -1 }); // latest first

    res.status(200).json({
      count: images.length,
      images
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch images" });
  }
});

// 🟢 Server Start
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
