const express = require('express');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// 1. CONEXÃO (Ajuste sua senha aqui)
const sequelize = new Sequelize('estacionamento_db', 'postgres', 'postgres', {
    host: 'localhost',
    dialect: 'postgres',
    logging: false
});

// 2. MODELOS
const Categoria = sequelize.define('categoria', {
    nome: { type: DataTypes.STRING, allowNull: false, unique: true },
    valorHora: { type: DataTypes.FLOAT, allowNull: false }
});

const Marca = sequelize.define('marca', { nome: { type: DataTypes.STRING, allowNull: false, unique: true } });
const Cor = sequelize.define('cor', { nome: { type: DataTypes.STRING, allowNull: false, unique: true } });
const Aro = sequelize.define('aro', { nome: { type: DataTypes.STRING, allowNull: false, unique: true } });

const Registro = sequelize.define('registro', {
    identificacao: { type: DataTypes.STRING },
    nomeUsuario: { type: DataTypes.STRING, allowNull: false },
    entrada: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    saida: { type: DataTypes.DATE },
    valorTotal: { type: DataTypes.FLOAT }
});

// ASSOCIAÇÕES
Registro.belongsTo(Categoria, { as: 'cat', foreignKey: 'CategoriaId' });
Registro.belongsTo(Marca, { as: 'mrc', foreignKey: 'MarcaId' });
Registro.belongsTo(Cor, { as: 'corRel', foreignKey: 'CorId' });
Registro.belongsTo(Aro, { as: 'aroRel', foreignKey: 'AroId' });

// 3. FUNÇÃO MESTRA CRUD (Gera 5 rotas por entidade automaticamente)
const gerarCRUD = (Model, rota) => {
    // POST (Criar)
    app.post(`/${rota}`, async (req, res) => res.status(201).json(await Model.create(req.body)));
    // GET Lista (Ler todos)
    app.get(`/${rota}`, async (req, res) => res.json(await Model.findAll({ order: [['id', 'ASC']] })));
    // GET por ID (Ler um)
    app.get(`/${rota}/:id`, async (req, res) => {
        const item = await Model.findByPk(req.params.id);
        item ? res.json(item) : res.status(404).json({ error: "Não encontrado" });
    });
    // PUT (Atualizar)
    app.put(`/${rota}/:id`, async (req, res) => {
        const item = await Model.findByPk(req.params.id);
        if (!item) return res.status(404).json({ error: "Não encontrado" });
        await item.update(req.body);
        res.json(item);
    });
    // DELETE (Apagar)
    app.delete(`/${rota}/:id`, async (req, res) => {
        const item = await Model.findByPk(req.params.id);
        if (!item) return res.status(404).json({ error: "Não encontrado" });
        await item.destroy();
        res.json({ message: "Excluído com sucesso" });
    });
};

// Gerando os CRUDs automáticos
gerarCRUD(Categoria, 'categorias');
gerarCRUD(Marca, 'marcas');
gerarCRUD(Cor, 'cores');
gerarCRUD(Aro, 'aros');

// 4. CRUD ESPECÍFICO DE REGISTROS (Com a Regra de Negócio)

// POST - Entrada
app.post('/registros', async (req, res) => {
    try {
        const novo = await Registro.create(req.body);
        res.status(201).json(novo);
    } catch (e) { res.status(400).json({ error: e.message }); }
});

// GET - Lista Ativos e Finalizados
app.get('/registros', async (req, res) => {
    res.json(await Registro.findAll({ include: ['cat', 'mrc', 'corRel', 'aroRel'], order: [['id', 'DESC']] }));
});

// GET por ID
app.get('/registros/:id', async (req, res) => {
    const r = await Registro.findByPk(req.params.id, { include: ['cat', 'mrc', 'corRel', 'aroRel'] });
    r ? res.json(r) : res.status(404).json({ error: "Registro não encontrado" });
});

// PUT - Saída com Cálculo de Horas (A REGRAS DE NEGÓCIO)
app.put('/registros/:id', async (req, res) => {
    try {
        const registro = await Registro.findByPk(req.params.id, { include: ['cat'] });
        if (!registro) return res.status(404).json({ error: "Registro não encontrado" });

        const agora = new Date();
        const diffMs = agora - new Date(registro.entrada);
        const horasDecimais = diffMs / (1000 * 60 * 60);
        
        // Regra de Negócio: Proporcionalidade
        const total = horasDecimais * registro.cat.valorHora;

        await registro.update({ saida: agora, valorTotal: total });
        res.json(registro);
    } catch (e) { res.status(500).json({ error: "Erro no cálculo" }); }
});

// DELETE - Remover Registro
app.delete('/registros/:id', async (req, res) => {
    const r = await Registro.findByPk(req.params.id);
    if (!r) return res.status(404).json({ error: "Não encontrado" });
    await r.destroy();
    res.json({ message: "Registro apagado" });
});

// Rota Extra de Utilidade
app.get('/proxima-ficha', async (req, res) => {
    const ultimo = await Registro.max('id');
    res.json({ proxima: String((ultimo || 0) + 1).padStart(3, '0') });
});

// 5. SERVIDOR E FRONT
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'welcome.html')));

sequelize.sync({ force: false }).then(() => {
    app.listen(3000, () => console.log("🚀 API BIKE PARK PRONTA PARA O 10!"));
});