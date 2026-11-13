// Calculator expression evaluator: + - * / ^ % ( ) sqr( ans
#include <math.h>
#include <string.h>
#include <stdlib.h>
#include "calc.h"

static const char *p;
static double s_ans;
static bool s_err;

static double expr(void);

static void skip(void) { while (*p == ' ') p++; }

static double primary(void)
{
    skip();
    if (*p == '(') {
        p++;
        double v = expr();
        skip();
        if (*p == ')') p++;              // tolerate a missing closing bracket
        return v;
    }
    if (!strncmp(p, "sqr(", 4)) {
        p += 3;
        double v = primary();
        if (v < 0) s_err = true;
        return sqrt(v);
    }
    if (!strncmp(p, "ans", 3)) { p += 3; return s_ans; }
    if (*p == '-') { p++; return -primary(); }
    char *end;
    double v = strtod(p, &end);
    if (end == p) { s_err = true; return 0; }
    p = end;
    return v;
}

static double postfix(void)
{
    double v = primary();
    skip();
    while (*p == '%') { v /= 100.0; p++; skip(); }
    return v;
}

static double power(void)
{
    double b = postfix();
    skip();
    if (*p == '^') { p++; return pow(b, power()); }   // right associative
    return b;
}

static double term(void)
{
    double v = power();
    for (;;) {
        skip();
        if (*p == '*') { p++; v *= power(); }
        else if (*p == '/') { p++; double d = power(); if (d == 0) s_err = true; else v /= d; }
        else return v;
    }
}

static double expr(void)
{
    double v = term();
    for (;;) {
        skip();
        if (*p == '+') { p++; v += term(); }
        else if (*p == '-') { p++; v -= term(); }
        else return v;
    }
}

bool calc_eval(const char *s, double *out)
{
    p = s;
    s_err = false;
    double v = expr();
    skip();
    if (*p || s_err || isnan(v) || isinf(v)) return false;
    *out = s_ans = v;
    return true;
}
