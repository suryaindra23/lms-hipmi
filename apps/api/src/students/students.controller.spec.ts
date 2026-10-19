import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QueryStudentsDto } from './students.controller';

describe('student list query', () => {
  it('transforms HTTP pagination strings into validated integers', async () => {
    const query = plainToInstance(QueryStudentsDto, { skip: '0', take: '50' });
    assert.equal(query.skip, 0);
    assert.equal(query.take, 50);
    assert.deepEqual(await validate(query), []);
  });

  it('rejects an excessive page size and an unknown lifecycle status', async () => {
    const query = plainToInstance(QueryStudentsDto, { take: '101', status: 'UNKNOWN' });
    const errors = await validate(query);
    assert.equal(errors.some((error) => error.property === 'take'), true);
    assert.equal(errors.some((error) => error.property === 'status'), true);
  });
});
