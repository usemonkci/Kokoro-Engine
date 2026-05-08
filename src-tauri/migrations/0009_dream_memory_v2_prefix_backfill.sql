-- Backfill structured metadata from the storage prefix introduced by the v2 writer:
-- [type:profile|key:user.name] User's name is ...
--
-- This is split from 0008 because SQLx migration checksums are immutable once a
-- migration has run on a user's database.

UPDATE memories
SET
    memory_type = CASE
        WHEN substr(content, 1, 6) = '[type:' AND instr(content, ']') > 0 THEN
            CASE
                WHEN instr(content, '|') > 0 AND instr(content, '|') < instr(content, ']') THEN
                    substr(content, 7, instr(content, '|') - 7)
                ELSE
                    substr(content, 7, instr(content, ']') - 7)
            END
        ELSE memory_type
    END,
    entity_key = CASE
        WHEN instr(content, '|key:') > 0 AND instr(content, ']') > instr(content, '|key:') THEN
            substr(
                content,
                instr(content, '|key:') + 5,
                instr(content, ']') - (instr(content, '|key:') + 5)
            )
        ELSE entity_key
    END
WHERE substr(content, 1, 6) = '[type:';
