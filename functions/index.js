const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// Exemplo: API para buscar pizzas
exports.getPizzas = functions.https.onRequest(async (req, res) => {
  try {
    const snapshot = await admin.firestore().collection("pizzas").get();
    const pizzas = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    res.json({ success: true, data: pizzas });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Exemplo: API para criar pedidos
exports.createOrder = functions.https.onRequest(async (req, res) => {
  try {
    const { cliente, itens, total } = req.body;
    
    const order = {
      cliente,
      itens,
      total,
      status: "pendente",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const docRef = await admin.firestore().collection("orders").add(order);
    
    res.json({ success: true, orderId: docRef.id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
