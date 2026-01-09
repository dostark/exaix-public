const cmd = new Deno.Command('echo', {
  args: ['hello', 'world'],
  stdout: 'piped',
  stderr: 'piped',
});
const { code, stdout, stderr } = await cmd.output();
const output = new TextDecoder().decode(stdout);
const errorOutput = new TextDecoder().decode(stderr);
console.log('code:', code);
console.log('output:', JSON.stringify(output));
console.log('error:', JSON.stringify(errorOutput));
