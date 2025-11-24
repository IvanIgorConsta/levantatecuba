const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const User = require("../models/User");
const { getOAuthRedirectBase } = require("../utils/redirectUtils");

/**
 * Normaliza el perfil de usuario desde diferentes proveedores
 */
function normalizeProfile(provider, profile) {
  let email = null;
  let name = profile.displayName || '';
  let avatar = '';
  
  // Extraer email
  if (profile.emails && profile.emails.length > 0) {
    email = profile.emails[0].value;
  }
  
  // Extraer avatar
  if (profile.photos && profile.photos.length > 0) {
    avatar = profile.photos[0].value;
  }
  
  // Mejorar name según el proveedor
  if (provider === 'google') {
    if (profile.name) {
      name = `${profile.name.givenName || ''} ${profile.name.familyName || ''}`.trim();
    }
  } else if (provider === 'facebook') {
    if (profile.name) {
      name = `${profile.name.givenName || ''} ${profile.name.familyName || ''}`.trim();
    }
  }
  
  return {
    id: profile.id,
    email,
    name: name || `${provider}_user_${profile.id}`,
    avatar
  };
}

/**
 * Lógica de cuentas unificadas
 */
async function findOrCreateUser(provider, profile) {
  const normalizedProfile = normalizeProfile(provider, profile);
  const providerId = normalizedProfile.id;
  const providerField = `providers.${provider}Id`;
  
  console.log(`🔍 OAuth ${provider}: Buscando usuario con ${providerField}=${providerId}`);
  
  try {
    // 1. Buscar por providerId existente
    let user = await User.findOne({ [providerField]: providerId });
    
    if (user) {
      console.log(`✅ Usuario encontrado por ${provider}Id:`, user.email || user.name);
      return user;
    }
    
    // 2. Si no existe pero hay email, buscar por email para vincular
    if (normalizedProfile.email) {
      user = await User.findOne({ email: normalizedProfile.email });
      
      if (user) {
        console.log(`🔗 Vinculando cuenta ${provider} a usuario existente:`, user.email);
        
        // Vincular la cuenta OAuth al usuario existente
        user.providers = user.providers || {};
        user.providers[`${provider}Id`] = providerId;
        
        // Actualizar avatar si no tiene uno
        if (!user.avatar && normalizedProfile.avatar) {
          user.avatar = normalizedProfile.avatar;
        }
        
        await user.save();
        return user;
      }
    }
    
    // 3. Crear nuevo usuario
    console.log(`➕ Creando nuevo usuario ${provider}:`, normalizedProfile.email || normalizedProfile.name);
    
    const newUserData = {
      name: normalizedProfile.name,
      role: "user",
      providers: {
        [`${provider}Id`]: providerId
      }
    };
    
    // Agregar email solo si existe
    if (normalizedProfile.email) {
      newUserData.email = normalizedProfile.email;
    }
    
    // Agregar avatar si existe
    if (normalizedProfile.avatar) {
      newUserData.avatar = normalizedProfile.avatar;
    }
    
    user = new User(newUserData);
    await user.save();
    
    console.log(`✅ Usuario ${provider} creado exitosamente:`, user._id);
    return user;
    
  } catch (error) {
    console.error(`❌ Error en findOrCreateUser para ${provider}:`, error.message);
    throw error;
  }
}

/**
 * Configuración de estrategia Google OAuth
 */
function configureGoogleStrategy() {
  const baseUrl = getOAuthRedirectBase();
  
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${baseUrl}/api/oauth/google/callback`,
    scope: ['profile', 'email'],
    passReqToCallback: true
  }, async (req, accessToken, refreshToken, profile, done) => {
    try {
      console.log(`🔐 Google OAuth callback para usuario:`, profile.id);
      
      const user = await findOrCreateUser('google', profile);
      return done(null, user);
    } catch (error) {
      console.error('❌ Error en Google OAuth:', error);
      return done(error, null);
    }
  }));
}

/**
 * Configuración de estrategia Facebook OAuth
 */
function configureFacebookStrategy() {
  const baseUrl = getOAuthRedirectBase();
  
  passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_CLIENT_ID,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    callbackURL: `${baseUrl}/api/oauth/facebook/callback`,
    profileFields: ['id', 'displayName', 'photos', 'email', 'name'],
    passReqToCallback: true
  }, async (req, accessToken, refreshToken, profile, done) => {
    try {
      console.log(`🔐 Facebook OAuth callback para usuario:`, profile.id);
      
      const user = await findOrCreateUser('facebook', profile);
      return done(null, user);
    } catch (error) {
      console.error('❌ Error en Facebook OAuth:', error);
      return done(error, null);
    }
  }));
}

/**
 * Configuración de serialización (no usamos sesiones, pero es requerido)
 */
function configurePassportSerialization() {
  // Serialización simple - no usamos sesiones
  passport.serializeUser((user, done) => {
    done(null, user._id);
  });
  
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id).select('-password');
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
}

/**
 * Inicializa todas las estrategias de Passport
 */
function initializePassport() {
  console.log('🔧 Configurando estrategias OAuth...');
  
  // Verificar variables de entorno
  const requiredEnvVars = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'FACEBOOK_CLIENT_ID', 
    'FACEBOOK_CLIENT_SECRET',
    'JWT_SECRET'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.warn(`⚠️ Variables de entorno faltantes para OAuth: ${missingVars.join(', ')}`);
    console.warn('OAuth no estará disponible hasta que se configuren.');
    return;
  }
  
  configurePassportSerialization();
  configureGoogleStrategy();
  configureFacebookStrategy();
  
  console.log('✅ Estrategias OAuth configuradas exitosamente');
}

module.exports = {
  initializePassport,
  findOrCreateUser,
  normalizeProfile
};
