'use strict';
const { Sequelize, DataTypes } = require('sequelize');
//const sequelize = new Sequelize(
//  'postgres://postgres:postgres@db/secret_board',
//  {
//    logging: false
//  }
//);

// herokuでDBと接続するときに必要なオプション
const dialectOptions = {
  ssl: {
    require: true,
    rejectUnauthorized: false
  }
};
// 有効な環境変数があるならprodのDB、無効ならdevのDBへの接続情報を定義する
const sequelize = process.env.DATABASE_URL ? 
  // prod
  new Sequelize(
    process.env.DATABASE_URL,
    {
      logging: false,
      dialectOptions
    }
  ) 
  : 
  // dev
  new Sequelize(
    'postgres://postgres:postgres@db/secret_board',
    {
      logging: false
    }
  );

const Post = sequelize.define(
  'Post',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    content: {
      type: DataTypes.TEXT
    },
    postedBy: {
      type: DataTypes.STRING
    },
    trackingCookie: {
      type: DataTypes.STRING
    }
  },
  {
    freezeTableName: true,
    timestamps: true
  }
);

Post.sync();
module.exports = Post;
