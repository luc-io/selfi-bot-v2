// ... (previous code) ...

// Check file count before adding the file
if (files.length + 1 > MAX_FILES) {
  throw new Error(`Maximum number of files (${MAX_FILES}) exceeded`);
}

files.push({
  buffer,
  filename: file.filename,
  contentType: file.mimetype
});

// ... (rest of the code) ...