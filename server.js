const express = require('express');
const { Sequelize, DataTypes, Op } = require('sequelize');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// 1. CONEXÃO COM O BANCO
const sequelize = new Sequelize('estacionamento_db', 'postgres', 'postgres', {
    host: 'localhost',
    dialect: 'postgres',
    port: 5432,
    logging: false
});

// 2. MODELOS
const Registro = sequelize.define('Registro', {
    identificacao: { type: DataTypes.STRING, allowNull: false },
    marca: { type: DataTypes.STRING },
    cor: { type: DataTypes.STRING },
    aro: { type: DataTypes.STRING },
    descricao: { type: DataTypes.STRING },
    observacao: { type: DataTypes.TEXT },
    valorHora: { type: DataTypes.FLOAT, defaultValue: 5.0 },
    entrada: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    saida: { type: DataTypes.DATE },
    valor: { type: DataTypes.FLOAT }
});

const Marca = sequelize.define('Marca', { nome: { type: DataTypes.STRING, unique: true } });
const Cor = sequelize.define('Cor', { nome: { type: DataTypes.STRING, unique: true } });
const Aro = sequelize.define('Aro', { tamanho: { type: DataTypes.STRING, unique: true } });

// 3. ROTAS
app.get('/marcas', async (req, res) => res.json(await Marca.findAll({ order: [['nome', 'ASC']] })));
app.get('/cores', async (req, res) => res.json(await Cor.findAll({ order: [['nome', 'ASC']] })));
app.get('/aros', async (req, res) => res.json(await Aro.findAll({ order: [['tamanho', 'ASC']] })));

app.get('/proxima-ficha', async (req, res) => {
    try {
        const ultimo = await Registro.findOne({ order: [['id', 'DESC']] });
        let proxima = 1;
        if (ultimo && !isNaN(ultimo.identificacao)) proxima = parseInt(ultimo.identificacao) + 1;
        res.json({ proxima: proxima.toString().padStart(3, '0') });
    } catch (e) { res.json({ proxima: "001" }); }
});

app.post('/entrada', async (req, res) => {
    try {
        let { identificacao, marca, aro, cor, descricao, observacao, valorHora } = req.body;
        if(marca) await Marca.findOrCreate({ where: { nome: marca.toUpperCase() } });
        if(cor) await Cor.findOrCreate({ where: { nome: cor.toUpperCase() } });
        if(aro) await Aro.findOrCreate({ where: { tamanho: aro.toUpperCase() } });

        const novo = await Registro.create({ 
            identificacao, marca, cor, aro, descricao, observacao, 
            valorHora: parseFloat(valorHora) || 5.0 
        });
        res.status(201).json(novo);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/bikes-ativas', async (req, res) => {
    res.json(await Registro.findAll({ where: { saida: null }, order: [['entrada', 'ASC']] }));
});

app.put('/saida/:id', async (req, res) => {
    try {
        const { observacaoFinal } = req.body;
        const registro = await Registro.findByPk(req.params.id);
        const agora = new Date();
        const horas = Math.max(1, Math.ceil((agora - new Date(registro.entrada)) / (1000 * 60 * 60)));
        const total = horas * registro.valorHora;

        let obsCompleta = registro.observacao || "";
        if (observacaoFinal) {
            obsCompleta += (obsCompleta ? " | FINALIZAÇÃO: " : "FINALIZAÇÃO: ") + observacaoFinal.toUpperCase();
        }

        await registro.update({ saida: agora, valor: total, observacao: obsCompleta });
        res.json({ valor: total });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/estatisticas', async (req, res) => {
    try {
        const historico = await Registro.findAll({ 
            where: { saida: { [Op.ne]: null } },
            order: [['identificacao', 'ASC']] // Ordenação padrão por ficha
        });
        const lucroTotal = await Registro.sum('valor', { where: { saida: { [Op.ne]: null } } }) || 0;
        const totalAtendidos = await Registro.count({ where: { saida: { [Op.ne]: null } } });
        res.json({ historico, lucroTotal, totalAtendidos });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Redirecionamento inicial
app.get('/', (req, res) => res.redirect('/welcome.html'));

// 4. SYNC E POPULAR DADOS
sequelize.sync({ alter: true }).then(async () => {
    if (await Marca.count() === 0) {
        await Marca.bulkCreate([{nome:'CALOI'}, {nome:'OGGI'}, {nome:'SENSE'}, {nome:'BMW'}]);
        await Cor.bulkCreate([{nome:'PRETA'}, {nome:'BRANCA'}, {nome:'AZUL'}, {nome:'VERMELHA'}]);
        await Aro.bulkCreate([{tamanho:'26'}, {tamanho:'29'}, {tamanho:'700'}]);
    }
    app.listen(3000, () => console.log("BIKE PARK ONLINE: http://localhost:3000"));
});