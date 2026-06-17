from django.db import migrations, models


def bold_to_pse(apps, schema_editor):
    Pedido = apps.get_model('orders', 'Pedido')
    Pedido.objects.filter(metodo_pago='bold').update(metodo_pago='pse')


def pse_to_bold(apps, schema_editor):
    Pedido = apps.get_model('orders', 'Pedido')
    Pedido.objects.filter(metodo_pago='pse').update(metodo_pago='bold')


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0002_metodo_pago'),
    ]

    operations = [
        migrations.RunPython(bold_to_pse, pse_to_bold),
        migrations.AlterField(
            model_name='pedido',
            name='metodo_pago',
            field=models.CharField(
                choices=[('efectivo', 'Efectivo'), ('pse', 'PSE (transferencia bancaria)')],
                default='efectivo',
                max_length=12,
                verbose_name='Método de pago',
            ),
        ),
    ]
