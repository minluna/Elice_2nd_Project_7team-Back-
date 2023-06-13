import { mysqlDB, User, Rank } from '../db/index.js';
import { UnauthorizedError, InternalServerError } from '../middlewares/errorMiddleware.js';

class rankService {
    static async getRankList({ userId, point, date }) {
        try {
            await mysqlDB.query('START TRANSACTION');
            let rankList = [];

            const user = await User.findById({ userId });

            if (!user) {
                throw new UnauthorizedError('잘못된 또는 만료된 토큰입니다.');
            }

            if (point == 0) {
                rankList = await Rank.firstRankList();
            } else if (point == -1) {
                rankList = '전체 불러오기가 끝났습니다.';
            } else {
                rankList = await Rank.getRankList({ point, date });
            }

            await mysqlDB.query('COMMIT');

            return {
                message: '전체 랭킹 리스트 불러오기에 성공했습니다.',
                rankList,
            };
        } catch (error) {
            await mysqlDB.query('ROLLBACK');

            if (error instanceof UnauthorizedError) {
                throw error;
            } else {
                throw new InternalServerError('전체 랭킹 리스트 불러오기에 실패했습니다.');
            }
        }
    }
}

export { rankService };
