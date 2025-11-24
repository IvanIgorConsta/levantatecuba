// Controlador base para usuarios (inactivo por ahora)

const User = require('../models/User');

// Ejemplo de creación de usuario
const createUser = async (req, res) => {
  try {
    const newUser = new User(req.body);
    await newUser.save();
    res.status(201).json({ message: 'Usuario creado' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { createUser };