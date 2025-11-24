const express = require('express');
const router = express.Router();
const Subscriber = require('../models/Subscriber');
const verifyToken = require('../middleware/verifyToken');
const verifyRole = require('../middleware/verifyRole');

// Obtener todos los suscriptores (solo admin/editor)
router.get('/', verifyToken, verifyRole(['admin', 'editor']), async (req, res) => {
  try {
    const subscribers = await Subscriber.find().sort({ createdAt: -1 });
    res.json(subscribers);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener los suscriptores' });
  }
});

// Agregar nuevo suscriptor
router.post('/', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'El correo es obligatorio' });
    }

    const alreadyExists = await Subscriber.findOne({ email });
    if (alreadyExists) {
      return res.status(400).json({ error: 'Este correo ya está suscrito' });
    }

    const newSubscriber = new Subscriber({ email });
    const saved = await newSubscriber.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: 'Error al guardar el suscriptor' });
  }
});

module.exports = router;
