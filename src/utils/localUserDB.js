import bcrypt from "bcryptjs";

// Obtener todos los usuarios desde localStorage
export const getUsers = () => {
  const stored = localStorage.getItem("users");
  return stored ? JSON.parse(stored) : [];
};

// Guardar lista de usuarios en localStorage
export const saveUsers = (users) => {
  localStorage.setItem("users", JSON.stringify(users));
};

// Buscar usuario por email
export const findUserByEmail = (email) => {
  const users = getUsers();
  return users.find((user) => user.email === email);
};

// Verificar login: email y contraseña
export const verifyLogin = async (email, password) => {
  const user = findUserByEmail(email);
  if (!user) return false;

  const match = await bcrypt.compare(password, user.password);
  return match ? user : false;
};

// Actualizar contraseña de un usuario
export const updatePassword = async (email, newPassword) => {
  const users = getUsers();
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  const updatedUsers = users.map((user) =>
    user.email === email ? { ...user, password: hashedPassword } : user
  );
  saveUsers(updatedUsers);

  console.log("🔐 Contraseña cifrada:", hashedPassword); // Puedes eliminar esta línea después de testear

  return true;
};

// Crear un usuario (ejemplo para test)
export const createUser = async (email, password, role = "editor") => {
  const existing = findUserByEmail(email);
  if (existing) throw new Error("Usuario ya existe");

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = { email, password: hashedPassword, role };
  const users = getUsers();
  saveUsers([...users, newUser]);
};
