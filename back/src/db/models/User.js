import { mysqlDB } from '../index.js';

class User {
    // 이메일을 이용하여 유저 검색
    static async findByEmail({ email }) {
        const query = 'SELECT id, password, nickname, description FROM user WHERE email = ?';
        const [rows] = await mysqlDB.query(query, [email]);

        return rows[0];
    }

    // 유저ID를 이용하여 유저 검색
    static async findById({ userId }) {
        const query = 'SELECT id, email, password, userImage FROM user WHERE id = ?';
        const [rows] = await mysqlDB.query(query, [userId]);

        return rows[0];
    }

    // 새로운 유저 생성
    static async create({ email, password, nickname }) {
        const query = 'INSERT INTO user (email, password, nickname, flag) VALUES (?, ?, ?, "일반")';
        const [rows] = await mysqlDB.query(query, [email, password, nickname]);

        return rows;
    }

    // 유저 정보 수정(내용, 별명)
    static async update({ userId, fieldToUpdate, newValue }) {
        const query = `UPDATE user SET ${fieldToUpdate} = ? WHERE id = ?`;
        const [rows] = await mysqlDB.query(query, [newValue, userId]);

        return rows; // update된 유저를 반환한다.
    }

    // 유저 정보 삭제
    static async delete({ userId }) {
        const query = 'UPDATE user SET deleteYN = "Y", deleteAt = CURRENT_TIMESTAMP WHERE id = ?';
        const [rows] = await mysqlDB.query(query, [userId]);

        return rows; // delete된 유저를 반환한다.
    }

    // 유저의 포인트 내역 불러오기
    static async getPoint({ userId }) {
        const query =
            'SELECT point.userId, point.currentPoint, point.accuPoint FROM user RIGHT JOIN point ON user.id = point.userId WHERE user.id = ?';
        const [rows] = await mysqlDB.query(query, [userId]);

        return rows[0];
    }

    // 전체 유저 수 불러오기
    static async getCount() {
        const query = 'SELECT COUNT(*) AS userCount FROM user';
        const [rows] = await mysqlDB.query(query);

        return rows[0];
    }
      
}

export { User };
