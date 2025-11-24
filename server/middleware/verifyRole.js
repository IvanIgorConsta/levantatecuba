// middleware/verifyRole.js
module.exports = function verifyRole(rolesPermitidos = []) {
  return function (req, res, next) {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ error: "No autorizado. Rol no detectado." });
    }

    if (!rolesPermitidos.includes(req.user.role)) {
      return res.status(403).json({ error: "Acción no permitida para tu rol." });
    }

    next();
  };
};
