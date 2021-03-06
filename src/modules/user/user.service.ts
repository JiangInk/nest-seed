import { Injectable, HttpStatus, HttpException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, getRepository } from 'typeorm';
import { UserEntity } from './user.entity';
import { CreateUserDto, LoginUserDto, UpdateUserDto } from './dto';
const jwt = require('jsonwebtoken');
import { JWTOptions } from '../../config';
import { UserRO } from './interface/user.interface';
import { validate } from 'class-validator';
import * as crypto from 'crypto';

@Injectable()
export class UserService {
    constructor(
        @InjectRepository(UserEntity)
        private readonly userRepository: Repository<UserEntity>
    ) { }

    /**
     * 获取所有用户信息
     */
    async findAll(): Promise<UserEntity[]> {
        return await this.userRepository.find();
    }

    /**
     * 登录用户查询
     * @param loginUserDto - 用户登录信息
     */
    async findOne(loginUserDto: LoginUserDto): Promise<UserEntity> {
        const findOneOptions = {
            email: loginUserDto.email,
            password: crypto.createHmac('sha256', loginUserDto.password).digest('hex'),
        };

        return await this.userRepository.findOne(findOneOptions);
    }

    /**
     * 注册创建用户
     * @param dto 
     */
    async create(dto: CreateUserDto): Promise<UserRO> {

        // check uniqueness of username/email
        const { name, email, password } = dto;
        const user = await getRepository(UserEntity)
            .createQueryBuilder('user')
            .where('user.name = :name', { name })
            .orWhere('user.email = :email', { email })
            .getOne();

        if (user) {
            const errors = { username: 'Username and email must be unique.' };
            throw new HttpException({ message: 'Input data validation failed', errors }, HttpStatus.BAD_REQUEST);
        }

        // create new user
        let newUser = new UserEntity();
        newUser.name = name;
        newUser.email = email;
        newUser.password = password;

        const errors = await validate(newUser);
        if (errors.length > 0) {
            const _errors = { username: 'Userinput is not valid.' };
            throw new HttpException({ message: 'Input data validation failed', _errors }, HttpStatus.BAD_REQUEST);

        } else {
            const savedUser = await this.userRepository.save(newUser);
            return this.buildUserRO(savedUser);
        }

    }

    /**
     * 更新用户信息
     * @param id - 用户ID
     * @param dto - 用户更新内容
     */
    async update(id: number, dto: UpdateUserDto): Promise<UserEntity> {
        let toUpdate = await this.userRepository.findOne(id);
        delete toUpdate.password;

        let updated = Object.assign(toUpdate, dto);
        return await this.userRepository.save(updated);
    }

    /**
     * 根据用户邮箱删除用户
     * @param email - 用户邮箱
     */
    async delete(email: string): Promise<any> {
        return await this.userRepository.delete({ email: email });
    }

    /**
     * 根据用户ID查找用户信息
     * @param id - 用户ID
     */
    async findById(id: number): Promise<UserRO> {
        const user = await this.userRepository.findOne(id);

        if (!user) {
            const errors = { User: ' not found' };
            throw new HttpException({ errors }, 401);
        };

        return this.buildUserRO(user);
    }

    /**
     * 根据用户邮箱查找用户信息
     * @param email - 用户邮箱
     */
    async findByEmail(email: string): Promise<UserRO> {
        const user = await this.userRepository.findOne({ email: email });
        return this.buildUserRO(user);
    }

    /**
     * 根据用户信息生成JWTtoken
     * @param user - 用户信息
     */
    public generateJWT(user) {
        let today = new Date();
        let exp = new Date(today);
        exp.setDate(today.getDate() + 60);

        return jwt.sign({
            id: user.id,
            username: user.username,
            email: user.email,
            exp: exp.getTime() / 1000,
        }, JWTOptions.secret);
    };

    /**
     * 构建用户输出信息
     * @param user - 用户信息
     */
    private buildUserRO(user: UserEntity) {
        const userRO = {
            name: user.name,
            email: user.email,
            bio: user.bio,
            token: this.generateJWT(user),
            avatar: user.avatar
        };

        return { user: userRO };
    }
}