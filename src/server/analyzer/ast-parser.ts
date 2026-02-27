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
    ast = parse(code, { loc: true, range: true, comment: false, jsx: false });
  } catch {
    return { methods, constants, imports, injections };
  }

  for (const node of ast.body) {
    if (node.type === 'ImportDeclaration') {
      const specifiers = node.specifiers
        .map(s => s.type === 'ImportSpecifier' && s.imported.type === 'Identifier' ? s.imported.name : null)
        .filter(Boolean) as string[];
      const source = typeof node.source.value === 'string' ? node.source.value : '';
      imports.push({ specifiers, source });
    }

    if (node.type === 'ExportNamedDeclaration' && node.declaration) {
      extractDeclaration(node.declaration, constants, methods);
    }

    if (node.type === 'ClassDeclaration' || (node.type === 'ExportNamedDeclaration' && node.declaration?.type === 'ClassDeclaration')) {
      const classNode = node.type === 'ClassDeclaration'
        ? node
        : node.declaration as TSESTree.ClassDeclaration;
      extractClass(classNode, methods, injections);
    }

    if (node.type === 'VariableDeclaration') {
      extractVariables(node, constants);
    }
  }

  return { methods, constants, imports, injections };
}

function extractClass(
  node: TSESTree.ClassDeclaration,
  methods: ParsedMethod[],
  injections: ParsedInjection[],
) {
  if (!node.body?.body) return;

  for (const member of node.body.body) {
    if (member.type === 'MethodDefinition' && member.key?.type === 'Identifier') {
      if (member.key.name === 'constructor') {
        extractConstructorInjections(member, injections);
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
  return 'unknown';
}

function extractVariables(node: TSESTree.VariableDeclaration, constants: ParsedConstant[]) {
  if (node.kind !== 'const') return;
  for (const decl of node.declarations) {
    if (decl.id?.type === 'Identifier') {
      constants.push({
        name: decl.id.name,
        startLine: node.loc.start.line,
        endLine: node.loc.end.line,
        isType: false,
      });
    }
  }
}

function extractDeclaration(
  node: TSESTree.ExportDeclaration,
  constants: ParsedConstant[],
  methods: ParsedMethod[],
) {
  if (node.type === 'TSInterfaceDeclaration' || node.type === 'TSTypeAliasDeclaration') {
    constants.push({
      name: node.id.name,
      startLine: node.loc.start.line,
      endLine: node.loc.end.line,
      isType: true,
    });
  }
  if (node.type === 'VariableDeclaration') {
    extractVariables(node, constants);
  }
}
