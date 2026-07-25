import multer from 'multer';
import path from 'path';

// Memory storage so file buffers go directly to S3 without touching local disk
const memoryStorage = multer.memoryStorage();

export const upload = multer({
  storage: memoryStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp|svg|mp4|webm/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image and video files are allowed!'));
  },
});
