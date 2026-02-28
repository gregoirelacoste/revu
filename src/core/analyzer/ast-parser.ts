import { parse } from '@typescript-eslint/typescript-estree';
import type { TSESTree } from '@typescript-eslint/typescript-estree';
import type { ParsedMethod, ParsedConstant, ParsedImport, ParsedInjection } from '../types.js';

interface ASTResult {
  methods: ParsedMethod[];
  constants: ParsedConstant[];
  imports: ParsedImport[];
  injections: ParsedInjection[];
}

export function parseTypeScript(code: string): ASTResult {
  const methods: ParsedMethod[] = [];
  const constants: ParsedConstant[] = [];
  const imports: ParsedImport[] = [];
  const injections: ParsedInjection[] = [];

  let ast: TSESTree.Program;
  try {
    ast = parse(code, { loc: true, range: true, comment: false, jsx: true });
  } catch {
    return { methods, constants, imports, injections };
  }

  for (const node of ast.body) {
    const inner = unwrapExport(node);

    // ── Imports ──
    if (node.type === 'ImportDeclaration') {
      const specifiers = node.specifiers
        .map(s => s.type === 'ImportSpecifier' && s.imported.type === 'Identifier' ? s.imported.name : null)
        .filter(Boolean) as string[];
      const source = typeof node.source.value === 'string' ? node.source.value : '';
      imports.push({ specifiers, source });
      continue;
    }

    // ── Classes ──
    if (inner.type === 'ClassDeclaration') {
      extractClass(inner, methods, injections);
      continue;
    }

    // ── Functions ──
    if (inner.type === 'FunctionDeclaration') {
      const name = inner.id?.name ?? 'anonymous';
      methods.push({
        name,
        startLine: node.loc.start.line,
        endLine: node.loc.end.line,
        signature: name,
        decorators: [],
      });
      continue;
    }

    // ── Enums ──
    if (inner.type === 'TSEnumDeclaration') {
      constants.push({
        name: inner.id.name,
        startLine: node.loc.start.line,
        endLine: node.loc.end.line,
        isType: false,
      });
      continue;
    }

    // ── Interfaces ──
    if (inner.type === 'TSInterfaceDeclaration') {
      constants.push({
        name: inner.id.name,
        startLine: node.loc.start.line,
        endLine: node.loc.end.line,
        isType: true,
      });
      continue;
    }

    // ── Type aliases ──
    if (inner.type === 'TSTypeAliasDeclaration') {
      constants.push({
        name: inner.id.name,
        startLine: node.loc.start.line,
        endLine: node.loc.end.line,
        isType: true,
      });
      continue;
    }

    // ── Variables (const, let, var) ──
    if (inner.type === 'VariableDeclaration') {
      for (const decl of inner.declarations) {
        const name = decl.id?.type === 'Identifier' ? decl.id.name : 'var';
        // Arrow functions / function expressions → method
        if (decl.init?.type === 'ArrowFunctionExpression' || decl.init?.type === 'FunctionExpression') {
          methods.push({
            name,
            startLine: node.loc.start.line,
            endLine: node.loc.end.line,
            signature: name,
            decorators: [],
          });
        } else {
          constants.push({
            name,
            startLine: node.loc.start.line,
            endLine: node.loc.end.line,
            isType: false,
          });
        }
      }
      continue;
    }

    // ── Expression statements (decorators, calls, assignments) ──
    if (inner.type === 'ExpressionStatement') {
      const name = expressionName(inner.expression);
      constants.push({
        name,
        startLine: node.loc.start.line,
        endLine: node.loc.end.line,
        isType: false,
      });
      continue;
    }

    // ── Module declarations (declare module, declare global) ──
    if (inner.type === 'TSModuleDeclaration') {
      const name = inner.id.type === 'Identifier' ? inner.id.name : 'module';
      constants.push({
        name: `module:${name}`,
        startLine: node.loc.start.line,
        endLine: node.loc.end.line,
        isType: true,
      });
      continue;
    }

    // ── Catch-all: any other top-level statement ──
    constants.push({
      name: `stmt:${node.type}`,
      startLine: node.loc.start.line,
      endLine: node.loc.end.line,
      isType: false,
    });
  }

  return { methods, constants, imports, injections };
}

// ── Unwrap export wrappers to get inner declaration ──

function unwrapExport(node: TSESTree.Statement): TSESTree.Statement {
  if (node.type === 'ExportNamedDeclaration' && node.declaration) {
    return node.declaration as TSESTree.Statement;
  }
  if (node.type === 'ExportDefaultDeclaration' && node.declaration) {
    const decl = node.declaration;
    if (decl.type === 'ClassDeclaration' || decl.type === 'FunctionDeclaration' || decl.type === 'TSEnumDeclaration') {
      return decl as unknown as TSESTree.Statement;
    }
  }
  return node;
}

// ── Class extraction (methods, constructor, properties) ──

function extractClass(
  node: TSESTree.ClassDeclaration,
  methods: ParsedMethod[],
  injections: ParsedInjection[],
) {
  if (!node.body?.body) return;
  const className = node.id?.name ?? 'Class';

  for (const member of node.body.body) {
    if (member.type === 'MethodDefinition' && member.key?.type === 'Identifier') {
      if (member.key.name === 'constructor') {
        extractConstructorInjections(member, injections);
        methods.push({
          name: `${className}.constructor`,
          startLine: member.loc.start.line,
          endLine: member.loc.end.line,
          signature: 'constructor',
          decorators: extractDecorators(member),
        });
        continue;
      }
      const decorators = extractDecorators(member);
      const httpInfo = extractHttpInfo(decorators);
      const sig = extractSignature(member);
      methods.push({
        name: member.key.name,
        startLine: member.loc.start.line,
        endLine: member.loc.end.line,
        signature: sig,
        decorators,
        ...httpInfo,
      });
    }

    if (member.type === 'PropertyDefinition' && member.key?.type === 'Identifier') {
      if (member.value?.type === 'ArrowFunctionExpression') {
        methods.push({
          name: member.key.name,
          startLine: member.loc.start.line,
          endLine: member.loc.end.line,
          signature: member.key.name,
          decorators: extractDecorators(member),
        });
      }
    }

    // Static blocks
    if (member.type === 'StaticBlock') {
      methods.push({
        name: `${className}.static`,
        startLine: member.loc.start.line,
        endLine: member.loc.end.line,
        signature: 'static',
        decorators: [],
      });
    }
  }
}

function extractConstructorInjections(
  ctorNode: TSESTree.MethodDefinition,
  injections: ParsedInjection[],
) {
  const fn = ctorNode.value;
  const params = fn.type === 'FunctionExpression' ? fn.params : [];
  for (const param of params) {
    const p = param.type === 'TSParameterProperty' ? param.parameter : param;
    if (p?.type === 'Identifier' && p.typeAnnotation?.typeAnnotation) {
      const typeAnno = p.typeAnnotation.typeAnnotation;
      if (typeAnno.type === 'TSTypeReference' && typeAnno.typeName?.type === 'Identifier') {
        injections.push({ paramName: p.name, typeName: typeAnno.typeName.name });
      }
    }
  }
}

// ── Helpers ──

function expressionName(expr: TSESTree.Expression): string {
  if (expr.type === 'CallExpression') {
    if (expr.callee.type === 'Identifier') return `${expr.callee.name}()`;
    if (expr.callee.type === 'MemberExpression' && expr.callee.property.type === 'Identifier') {
      const obj = expr.callee.object.type === 'Identifier' ? expr.callee.object.name : '';
      return `${obj}.${expr.callee.property.name}()`;
    }
  }
  if (expr.type === 'AssignmentExpression' && expr.left.type === 'MemberExpression') {
    if (expr.left.property.type === 'Identifier') return expr.left.property.name;
  }
  return 'expression';
}

function extractDecorators(node: TSESTree.MethodDefinition | TSESTree.PropertyDefinition): string[] {
  return (node.decorators ?? []).map((d: TSESTree.Decorator) => {
    const expr = d.expression;
    if (expr.type === 'CallExpression' && expr.callee?.type === 'Identifier') {
      const args = expr.arguments
        ?.map((a: TSESTree.CallExpressionArgument) =>
          a.type === 'Literal' ? String(a.value) : '',
        )
        .join(', ') ?? '';
      return `@${expr.callee.name}(${args})`;
    }
    if (expr.type === 'Identifier') return `@${expr.name}`;
    return '@unknown';
  });
}

function extractHttpInfo(decorators: string[]): { httpVerb?: string; httpPath?: string } {
  for (const d of decorators) {
    const match = d.match(/^@(Get|Post|Put|Delete|Patch)\((.*)?\)$/);
    if (match) {
      return {
        httpVerb: match[1].toUpperCase(),
        httpPath: match[2]?.replace(/['"]/g, '') || '/',
      };
    }
  }
  return {};
}

function extractSignature(method: TSESTree.MethodDefinition): string {
  const fn = method.value;
  const params = fn.type === 'FunctionExpression' ? fn.params : [];
  const paramStr = params.map((p: TSESTree.Parameter) => {
    if (p.type === 'Identifier') return p.name;
    if (p.type === 'TSParameterProperty' && p.parameter?.type === 'Identifier') return p.parameter.name;
    return '?';
  }).join(', ');
  const returnType = fn.type === 'FunctionExpression' ? fn.returnType?.typeAnnotation : undefined;
  const ret = returnType ? `: ${formatType(returnType)}` : '';
  const key = method.key.type === 'Identifier' ? method.key.name : '?';
  return `${key}(${paramStr})${ret}`;
}

function formatType(node: TSESTree.TypeNode): string {
  if (!node) return 'unknown';
  if (node.type === 'TSTypeReference' && node.typeName?.type === 'Identifier') {
    const typeArgs = node.typeArguments?.params?.map(formatType).join(', ');
    return typeArgs ? `${node.typeName.name}<${typeArgs}>` : node.typeName.name;
  }
  if (node.type === 'TSVoidKeyword') return 'void';
  if (node.type === 'TSBooleanKeyword') return 'boolean';
  if (node.type === 'TSStringKeyword') return 'string';
  if (node.type === 'TSNumberKeyword') return 'number';
  if (node.type === 'TSAnyKeyword') return 'any';
  if (node.type === 'TSNullKeyword') return 'null';
  if (node.type === 'TSUndefinedKeyword') return 'undefined';
  if (node.type === 'TSObjectKeyword') return 'object';
  if (node.type === 'TSArrayType') return `${formatType(node.elementType)}[]`;
  if (node.type === 'TSUnionType') return node.types.map(formatType).join(' | ');
  if (node.type === 'TSIntersectionType') return node.types.map(formatType).join(' & ');
  if (node.type === 'TSLiteralType') {
    if (node.literal.type === 'Literal') return String(node.literal.value);
    return 'literal';
  }
  if (node.type === 'TSTupleType') return `[${node.elementTypes.map(formatType).join(', ')}]`;
  return 'unknown';
}
