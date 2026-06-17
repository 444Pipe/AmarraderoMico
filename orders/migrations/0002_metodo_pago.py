from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='pedido',
            name='metodo_pago',
            field=models.CharField(
                choices=[('efectivo', 'Efectivo'), ('bold', 'BOLD (tarjeta/PSE/Nequi)')],
                default='efectivo',
                max_length=12,
                verbose_name='Método de pago',
            ),
        ),
        migrations.AddField(
            model_name='pedido',
            name='paga_con',
            field=models.CharField(blank=True, max_length=60, verbose_name='Paga con'),
        ),
    ]
