import {ShaderAttributeObject} from '../myLib/webgl/engine/ShaderAttributeObject';
import {ShaderObject} from '../myLib/webgl/engine/ShaderObject';
import {UniformObject} from '../myLib/webgl/engine/UniformObject';
import {TextureObject} from '../myLib/webgl/engine/TextureObject';

export class SimpleTexturingShader extends ShaderObject
{
  private _texture:TextureObject;

  public set texture(value:TextureObject)
  {
    if(value !== this._texture)
    {
      this._texture = value;
      this.uniformList[1].texture = value.texture;
    }
  }

  public get texture():TextureObject
  {
    return this._texture;
  }

  public init():void
  {
    this.vShaderSource = `
    attribute vec3 position;
    attribute vec2 uv;
    uniform mat4 mvpMatrix;
    varying vec2 vUV;
    
    void main(void)
    {
      vUV = uv;
      gl_Position = mvpMatrix * vec4(position, 1.0);
    }
    `;

    this.fShaderSource = `
    precision mediump float;
    
    uniform sampler2D texture;
    varying vec2 vUV;
    
    void main(void)
    {
      gl_FragColor = texture2D(texture, vUV);
    }
    `;

    let uniform:UniformObject;
    uniform = new UniformObject(UniformObject.TYPE_MATRIX, 'mvpMatrix');
    this.uniformList[0] = uniform;

    uniform = new UniformObject(UniformObject.TYPE_TEXTURE, 'texture');
    uniform.value = 0;
    this.uniformList[1] = uniform;

    let attribute:ShaderAttributeObject;
    attribute = new ShaderAttributeObject('position', 3);
    this.attributeList[0] = attribute;

    attribute = new ShaderAttributeObject('uv', 2);
    this.attributeList[1] = attribute;

    this.createProgram();
  }
}
