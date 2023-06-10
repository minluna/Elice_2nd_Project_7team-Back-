import { mysqlDB, User } from '../db/index.js';
import {
    ConflictError,
    UnauthorizedError,
    BadRequestError,
    NotFoundError,
    InternalServerError,
} from '../middlewares/errorMiddleware.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { s3 } from '../aws.config.js';

class userAuthService {
    // 유저 생성
    static async createUser({ email, password, nickname, imageUrl }) {
        try {
            await mysqlDB.query('START TRANSACTION');

            // 이메일 중복 확인
            const user = await User.findByEmail({ email });

            if (user) {
                throw new ConflictError('이 이메일은 현재 사용중입니다. 다른 이메일을 입력해 주세요.');
            }

            // 비밀번호 암호화
            const hashedPassword = await bcrypt.hash(password, parseInt(process.env.PW_HASH_COUNT));

            await User.create({
                email,
                password: hashedPassword,
                nickname,
                imageUrl,
            });

            await mysqlDB.query('COMMIT');

            return {
                statusCode: 200,
                message: '회원가입에 성공했습니다.',
            };
        } catch (error) {
            await mysqlDB.query('ROLLBACK');

            if (error instanceof ConflictError) {
                throw error;
            } else {
                throw new BadRequestError('회원가입에 실패했습니다.');
            }
        }
    }

    // 로그인 검사
    static async getUser({ email, password }) {
        try {
            const user = await User.findByEmail({ email });

            // 이메일 검증
            if (!user) {
                throw new NotFoundError('해당 이메일은 가입 내역이 없습니다. 다시 한 번 확인해 주세요.');
            }

            // 비밀번호 확인
            const correctPasswordHash = user.password;
            const isPasswordCorrect = await bcrypt.compare(password, correctPasswordHash);

            if (!isPasswordCorrect) {
                throw new UnauthorizedError('비밀번호가 일치하지 않습니다. 다시 한 번 확인해 주세요.');
            }

            // 유저 정보가 있고 비밀번호가 일치하면 JWT 토큰을 생성한다.
            const secretKey = process.env.JWT_SECRET_KEY || 'jwt-secret-key';
            const token = jwt.sign(
                { userId: user.id, email: user.email, name: user.nickname, description: user.description },
                secretKey,
            );

            return {
                statusCode: 200,
                message: '로그인에 성공했습니다.',
                token,
            };
        } catch (error) {
            if (error instanceof NotFoundError) {
                throw error;
            } else if (error instanceof UnauthorizedError) {
                throw error;
            } else {
                throw new UnauthorizedError('로그인에 실패하셨습니다.');
            }
        }
    }

    // ID로 유저 검색(로그인 체크)
    static async loginCheck({ userId }) {
        try {
            const user = await User.findById({ userId });

            if (!user) {
                throw new NotFoundError('요청한 사용자의 정보를 찾을 수 없습니다.');
            } else {
                return {
                    statusCode: 200,
                    message: '정상적인 유저입니다.',
                    userId: user.id,
                    email: user.email,
                    nickname: user.nickname,
                    userImage: user.userImage,
                };
            }
        } catch (error) {
            throw error;
        }
    }

    // 유저의 현재 포인트, 누적 포인트 불러오기
    static async getUserPoint({ userId }) {
        try {
            const user = await User.findById({ userId });

            if (!user) {
                throw new UnauthorizedError('잘못된 또는 만료된 토큰입니다.');
            }

            const getUserPoint = await User.getPoint({ userId });

            return {
                statusCode: 200,
                message: '유저 포인트 내역 불러오기에 성공했습니다.',
                userPoint: {
                    id: getUserPoint.id,
                    nickname: getUserPoint.nickname,
                    imageUrl: getUserPoint.imageUrl,
                    accuPoint: getUserPoint.accuPoint,
                },
            };
        } catch (error) {
            if (error instanceof UnauthorizedError) {
                throw error;
            } else {
                throw new InternalServerError('유저 포인트 내역 불러오기에 실패했습니다.');
            }
        }
    }

    // 전체 유저 수 불러오기
    static async getUserCount({ userId }) {
        try {
            const user = await User.findById({ userId });

            if (!user) {
                throw new UnauthorizedError('잘못된 또는 만료된 토큰입니다.');
            }

            const getUserCount = await User.getCount();

            return {
                statusCode: 200,
                message: '전체 유저 수 불러오기에 성공하셨습니다.',
                userCount: getUserCount.userCount,
            };
        } catch (error) {
            if (error instanceof UnauthorizedError) {
                throw error;
            } else {
                throw new InternalServerError('전체 유저 수 불러오기에 실패했습니다.');
            }
        }
    }

    // 유저 정보 불러오기
    static async getUserInfo({ userId }) {
        try {
            const user = await User.findById({ userId });

            if (!user) {
                throw new NotFoundError('요청한 사용자의 정보를 찾을 수 없습니다.');
            } else {
                return {
                    statusCode: 200,
                    message: '유저 정보 불러오기에 성공하셨습니다.',
                    userInfo: {
                        id: user.id,
                        email: user.email,
                        nickname: user.nickname,
                        userImage: user.userImage,
                    },
                };
            }
        } catch (error) {
            throw error;
        }
    }

    // 유저 정보 수정(별명, 설명)
    static async setUserInfo({ userId, toUpdate, imageUrl }) {
        try {
            await mysqlDB.query('START TRANSACTION');

            const user = await User.findById({ userId });

            if (!user) {
                throw new NotFoundError('요청한 사용자의 정보를 찾을 수 없습니다.');
            }

            // toUpdate -> nickName, description
            for (const [fieldToUpdate, newValue] of Object.entries(toUpdate)) {
                await User.update({ userId, fieldToUpdate, newValue, imageUrl });
            }

            await mysqlDB.query('COMMIT');

            return {
                statusCode: 200,
                message: '유저 정보 수정하기에 성공하셨습니다.',
            };
        } catch (error) {
            await mysqlDB.query('ROLLBACK');

            if (error instanceof NotFoundError) {
                throw error;
            } else {
                throw new InternalServerError('유저 정보 수정하기에 실패했습니다.');
            }
        }
    }

    // 유저 정보 삭제
    static async delUserInfo({ userId }) {
        try {
            await mysqlDB.query('START TRANSACTION');

            const user = await User.findById({ userId });

            if (!user) {
                throw new NotFoundError('요청한 사용자의 정보를 찾을 수 없습니다.');
            }

            await User.delete({ userId });

            await mysqlDB.query('COMMIT');

            return {
                statusCode: 200,
                message: '유저 정보 삭제하기에 성공하셨습니다.',
            };
        } catch (error) {
            await mysqlDB.query('ROLLBACK');

            if (error instanceof NotFoundError) {
                throw error;
            } else {
                throw new InternalServerError('유저 정보 삭제하기에 실패했습니다.');
            }
        }
    }
}

export { userAuthService };
