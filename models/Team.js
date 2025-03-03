const { DataTypes } = require('sequelize');
const sequelize = require('./index');

const Team = sequelize.define('Team', {
    teamName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    teamCode: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    walletCode: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    leaderId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    score: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    }
});

module.exports = Team;
