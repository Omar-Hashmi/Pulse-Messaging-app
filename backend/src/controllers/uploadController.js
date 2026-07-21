export const uploadFile = (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  res.status(201).json({
    url: `/uploads/${req.file.filename}`,
    fileName: req.file.originalname,
    fileType: req.file.mimetype,
    fileSize: req.file.size
  });
};
